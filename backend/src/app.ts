import { frontendDist } from "./config/paths.js";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { ZodError } from "zod";
import { connectStore } from "./models/store.js";
import { seed } from "./services/seed.js";
import { migrateTaskLogs } from "./services/projects.js";
import { runJobs } from "./services/operations.js";
import { api } from "./controllers/api.js";
import { allowAllOrigins } from "./middleware/cors.js";
const production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.MONGODB_URI ||
    process.env.DEMO_MODE !== "false" ||
    !process.env.APP_ORIGIN?.startsWith("https://"))
)
  throw new Error(
    "Production requires MONGODB_URI, DEMO_MODE=false, and an HTTPS APP_ORIGIN.",
  );
await connectStore();
await seed(!production && process.env.DEMO_MODE !== "false");
await migrateTaskLogs();
export const app = express();
app.disable("x-powered-by");
if (production) app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
app.use("/api", allowAllOrigins);
app.use(express.json({ limit: "32kb" }), cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (production && !req.secure)
    return res.status(400).json({ error: "HTTPS is required." });
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!req.is("application/json"))
      return res.status(415).json({ error: "JSON requests required." });
  }
  next();
});
// Serialize local mutations and job passes. Production is intentionally a single API instance.
let queue = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>) {
  const result = queue.then(fn);
  queue = result.then(
    () => {},
    () => {},
  );
  return result;
}
app.use("/api", (req, res, next) => {
  void exclusive(
    () =>
      new Promise<void>((resolve) => {
        res.once("finish", resolve);
        res.once("close", resolve);
        next();
      }),
  );
});
app.use("/api", api);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use(express.static(frontendDist));
app.get("*", (_req, res) =>
  res.sendFile(path.join(frontendDist, "index.html")),
);
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof ZodError)
      return res.status(400).json({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON." });
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  },
);
await runJobs();
setInterval(() => {
  void exclusive(() => runJobs()).catch(console.error);
}, 30000).unref();
const port = Number(process.env.PORT || 4000);
app.listen(port, process.env.HOST || "0.0.0.0", () =>
  console.log(
    `Workpulse API: http://127.0.0.1:${port} (${production ? "production" : "local development"})`,
  ),
);
