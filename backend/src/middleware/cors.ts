import type { Request, Response, NextFunction } from "express";

// Any requesting origin is allowed, including credentialed frontend requests.
// Browsers reject Access-Control-Allow-Origin: * when credentials are included.
export function allowAllOrigins(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.get("Origin");
  res.vary("Origin");
  res.set("Access-Control-Allow-Origin", origin || "*");
  res.set("Access-Control-Allow-Credentials", "true");
  res.set(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
  res.set("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}
