import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
export const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
export const frontendDist = path.resolve(backendRoot, "../frontend/dist");
// Isolated tests provide their own environment and must never load real credentials.
if (process.env.NODE_ENV !== "test") {
  dotenv.config({ path: path.join(backendRoot, ".env") });
}
