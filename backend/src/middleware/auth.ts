import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { all, get, put, remove } from "../models/store.js";
import type { Device, Employee, Session } from "../models/types.js";
declare global {
  namespace Express {
    interface Request {
      user: Employee;
      authSession: Session;
    }
  }
}
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export const secret = () => randomBytes(32).toString("hex");
export const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production"
      ? ("none" as const)
      : ("lax" as const),
  path: "/",
};
export const deviceCookieName = (employeeId: string) =>
  `wp_device_${digest(employeeId).slice(0, 24)}`;
export function deviceCredential(req: Request, device: Device) {
  // Keep valid legacy cookies usable, while account switches no longer overwrite them.
  return [
    req.cookies[deviceCookieName(device.employeeId)],
    req.cookies.wp_device,
  ].find(
    (token) =>
      typeof token === "string" &&
      token.length > 0 &&
      digest(token) === device.tokenHash,
  );
}
export function rememberDevice(
  res: Response,
  employeeId: string,
  token: string,
) {
  res.cookie(deviceCookieName(employeeId), token, {
    ...cookie,
    maxAge: 365 * 86400000,
  });
}
export async function issue(res: Response, user: Employee, deviceId: string) {
  const token = secret();
  const session: Session = {
    id: randomUUID(),
    tokenHash: digest(token),
    employeeId: user.id,
    deviceId,
    expiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
    rotatedAt: new Date().toISOString(),
    csrf: secret(),
  };
  await put("sessions", session);
  res.cookie("wp_session", token, { ...cookie, maxAge: 12 * 3600000 });
  return session;
}
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies.wp_session;
    if (!token)
      return res.status(401).json({ error: "Please sign in to continue." });
    const session = (await all("sessions")).find(
      (s) => s.tokenHash === digest(token),
    );
    if (!session || new Date(session.expiresAt).getTime() < Date.now())
      return res
        .status(401)
        .json({ error: "Your session has expired. Please sign in again." });
    const user = await get("employees", session.employeeId),
      device = await get("devices", session.deviceId);
    if (
      !user ||
      user.status !== "Active" ||
      !device ||
      device.status !== "Approved" ||
      device.employeeId !== user.id ||
      !deviceCredential(req, device)
    )
      return res
        .status(401)
        .json({ error: "Account or device access has been revoked." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-csrf-token"] !== session.csrf
    )
      return res
        .status(403)
        .json({ error: "Security token mismatch. Reload the page." });
    if (Date.now() - new Date(session.rotatedAt).getTime() > 15 * 60000) {
      const nextToken = secret();
      session.tokenHash = digest(nextToken);
      session.rotatedAt = new Date().toISOString();
      await put("sessions", session);
      res.cookie("wp_session", nextToken, {
        ...cookie,
        maxAge: new Date(session.expiresAt).getTime() - Date.now(),
      });
    }
    req.user = user;
    req.authSession = session;
    next();
  } catch (e) {
    next(e);
  }
}
export function admin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Administrator access required." });
  next();
}
export async function revokeSessions(employeeId: string) {
  for (const s of await all("sessions"))
    if (s.employeeId === employeeId) await remove("sessions", s.id);
}
