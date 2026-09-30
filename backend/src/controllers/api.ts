import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { all, get, put, remove } from "../models/store.js";
import {
  authenticate,
  admin,
  digest,
  secret,
  cookie,
  issue,
  revokeSessions,
  deviceCredential,
  rememberDevice,
} from "../middleware/auth.js";
import { at, day, late, isWeekend } from "../services/rules.js";
import { monthlyAttendance } from "../services/monthly-attendance.js";
import {
  settings,
  event,
  closeSession,
  snapshot,
  monthly,
} from "../services/operations.js";
const route =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
export const api = Router();
const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
});
const loginLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
  handler: async (req, res) => {
    await event(
      "security_events",
      "",
      "Multiple failed login attempts",
      "Authentication rate limit reached.",
      { ip: req.ip || "", device: req.get("user-agent") || "" },
    );
    res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  },
});
const demo = () =>
  process.env.DEMO_MODE !== "false" && process.env.NODE_ENV !== "production";
api.get("/config", (_req, res) => res.json({ demo: demo() }));
async function verify(req: Request) {
  const input = credentials.parse(req.body);
  const user = (await all("employees")).find((e) => e.email === input.email);
  const valid =
    user && (await bcrypt.compare(input.password, user.passwordHash));
  if (!valid || user.status !== "Active") {
    await event(
      "security_events",
      user?.id || "",
      "Invalid login attempt",
      "Incorrect credentials or inactive account.",
      { ip: req.ip || "", device: req.get("user-agent") || "" },
    );
    return null;
  }
  return user;
}
async function checkIn(userId: string, deviceId: string) {
  const s = await settings(),
    today = day();
  if (isWeekend(today)) return;
  if (Date.now() >= at(today, s.endTime).getTime()) return;
  if (
    (await all("attendance")).some(
      (a) => a.employeeId === userId && a.date === today,
    )
  )
    return;
  const now = new Date();
  await put("attendance", {
    id: randomUUID(),
    employeeId: userId,
    date: today,
    loginTime: now.toISOString(),
    logoutTime: null,
    deviceId,
    breakMinutes: 0,
    breakStartedAt: null,
    status: late(now, s) ? "Late" : "On time",
    autoClosed: false,
  });
  await event(
    "notifications",
    userId,
    late(now, s) ? "Late login" : "Employee logged in",
    "Attendance recorded from an approved device.",
  );
  await event("audit_logs", userId, "Checked in", "Attendance started");
}
api.post(
  "/auth/login",
  loginLimit,
  route(async (req, res) => {
    const user = await verify(req);
    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });
    const ua = req.get("user-agent") || "";
    let device = (await all("devices")).find(
      (d) => d.employeeId === user.id && !!deviceCredential(req, d),
    );
    // Verified admin credentials grant direct access on each browser. The role
    // comes from the stored account, never from the login request.
    if (user.role === "admin" && (!device || device.status !== "Approved")) {
      const token = secret();
      device = {
        id: device?.id || randomUUID(),
        employeeId: user.id,
        name: "Administrator workstation",
        os: "Registered workstation",
        browser: ua.slice(0, 150),
        fingerprint: "Verified administrator sign-in",
        tokenHash: digest(token),
        status: "Approved",
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };
      await put("devices", device);
      rememberDevice(res, user.id, token);
      await event(
        "audit_logs",
        user.id,
        "Admin browser registered",
        "Browser credential issued after verifying the administrator password.",
        { ip: req.ip || "", device: device.id },
      );
    }
    if (
      (user.role !== "admin" && /Android|iPhone|Mobile|iPad/i.test(ua)) ||
      !device ||
      device.status !== "Approved"
    ) {
      if (
        user.role === "employee" &&
        !/Android|iPhone|Mobile|iPad/i.test(ua) &&
        device
      ) {
        const token = deviceCredential(req, device);
        if (token) rememberDevice(res, user.id, token);
        if (device.status !== "Pending") {
          await event(
            "security_events",
            user.id,
            "Unauthorized device",
            `Login blocked for ${device.status.toLowerCase()} device.`,
            { ip: req.ip || "", device: device.id },
          );
        }
        return res.status(403).json({
          error:
            device.status === "Pending"
              ? "Your laptop request is awaiting admin approval. Once approved, sign in again; you do not need to submit another request."
              : `This laptop access is ${device.status.toLowerCase()}. Please contact your administrator.`,
          deviceStatus: device.status,
          deviceRequired: false,
        });
      }
      await event(
        "security_events",
        user.id,
        "Unauthorized device",
        "Access blocked: device not approved or mobile browser detected.",
        { ip: req.ip || "", device: ua.slice(0, 200) },
      );
      return res.status(403).json({
        error:
          "This device is not authorized. Request access from your administrator.",
        deviceRequired: !/Android|iPhone|Mobile|iPad/i.test(ua),
        deviceStatus: /Android|iPhone|Mobile|iPad/i.test(ua)
          ? "Blocked"
          : "Missing",
      });
    }
    device.lastUsed = new Date().toISOString();
    const savedCredential = deviceCredential(req, device);
    if (savedCredential) rememberDevice(res, user.id, savedCredential);
    await put("devices", device);
    const session = await issue(res, user, device.id);
    if (user.role === "employee") await checkIn(user.id, device.id);
    await event(
      "audit_logs",
      user.id,
      "Signed in",
      "Authenticated using approved device",
      { ip: req.ip || "", device: device.id },
    );
    res.json({
      csrf: session.csrf,
      user: { name: user.name, role: user.role },
    });
  }),
);
api.post(
  "/auth/request-device",
  loginLimit,
  route(async (req, res) => {
    const user = await verify(req);
    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });
    if (user.role === "admin")
      return res.status(400).json({
        error:
          "Admin accounts sign in directly. Return to sign in; device approval is not required.",
      });
    if (/Android|iPhone|Mobile|iPad/i.test(req.get("user-agent") || ""))
      return res
        .status(403)
        .json({ error: "Mobile devices cannot be registered." });
    const existing = (await all("devices")).find(
      (d) => d.employeeId === user.id && !!deviceCredential(req, d),
    );
    if (existing) {
      rememberDevice(res, user.id, deviceCredential(req, existing)!);
      return res
        .status(
          existing.status === "Pending" || existing.status === "Approved"
            ? 200
            : 403,
        )
        .json({
          deviceStatus: existing.status,
          deviceRequired: false,
          ...(existing.status === "Revoked" || existing.status === "Rejected"
            ? {
                error: `This laptop access is ${existing.status.toLowerCase()}. Please contact your administrator.`,
              }
            : {
                message:
                  existing.status === "Approved"
                    ? "This laptop is already approved. Sign in to open your dashboard."
                    : "Your request is already awaiting approval. No new request is needed.",
              }),
        });
    }
    const input = z
      .object({
        name: z.string().min(3).max(100),
        os: z.string().min(2).max(60),
        fingerprint: z.string().max(300).optional(),
      })
      .parse(req.body);
    const token = secret();
    const device = await put("devices", {
      id: randomUUID(),
      employeeId: user.id,
      name: input.name,
      os: input.os,
      browser: (req.get("user-agent") || "").slice(0, 150),
      fingerprint: input.fingerprint || "",
      tokenHash: digest(token),
      status: "Pending",
      createdAt: new Date().toISOString(),
      lastUsed: "",
    });
    rememberDevice(res, user.id, token);
    await event(
      "notifications",
      user.id,
      "New device request",
      `${input.name} is awaiting approval.`,
    );
    await event("audit_logs", user.id, "Device requested", device.name, {
      ip: req.ip || "",
    });
    res.json({
      deviceStatus: "Pending",
      message:
        "Request sent. Sign in from this browser after your administrator approves it.",
    });
  }),
);
api.post(
  "/auth/demo",
  loginLimit,
  route(async (req, res) => {
    if (!demo()) return res.sendStatus(404);
    const role = z.enum(["admin", "employee"]).parse(req.body.role);
    const user = (await all("employees")).find(
      (e) => e.role === role && e.status === "Active",
    )!;
    const token = secret(),
      id = randomUUID();
    await put("devices", {
      id,
      employeeId: user.id,
      name: "Local demo browser",
      os: "Demo",
      browser: "Demo",
      fingerprint: "DEMO ONLY",
      tokenHash: digest(token),
      status: "Approved",
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    });
    rememberDevice(res, user.id, token);
    const s = await issue(res, user, id);
    res.json({ csrf: s.csrf });
  }),
);
api.use(authenticate);
api.get(
  "/attendance/monthly",
  route(async (req, res) => {
    const month = z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .parse(req.query.month);
    const employeeId =
      req.user.role === "admin"
        ? z.string().parse(req.query.employeeId)
        : req.user.id;
    const employee = await get("employees", employeeId);
    if (!employee || employee.role !== "employee")
      return res.status(404).json({ error: "Employee not found." });
    const records = (await all("attendance")).filter(
      (a) => a.employeeId === employeeId && a.date.startsWith(month),
    );
    const adjustments = (await all("attendance_adjustments")).filter(
      (a) => a.employeeId === employeeId && a.date.startsWith(month),
    );
    res.json({
      ...monthlyAttendance(
        month,
        employee.joiningDate,
        records,
        adjustments,
        await settings(),
      ),
      employeeId,
    });
  }),
);
api.put(
  "/attendance/day-status",
  admin,
  route(async (req, res) => {
    const input = z
      .object({
        employeeId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["Leave", "Half Day", "Automatic"]),
        reason: z.string().max(500).default(""),
      })
      .parse(req.body);
    const employee = await get("employees", input.employeeId);
    if (!employee || employee.role !== "employee")
      return res.status(404).json({ error: "Employee not found." });
    if (
      !Number.isFinite(at(input.date, "12:00").getTime()) ||
      day(at(input.date, "12:00")) !== input.date ||
      input.date < employee.joiningDate
    )
      return res
        .status(400)
        .json({ error: "Choose a valid date on or after the joining date." });
    const id = `${input.employeeId}:${input.date}`;
    if (isWeekend(input.date) && input.status !== "Automatic")
      return res.status(400).json({
        error:
          "Saturday and Sunday are fixed weekly offs. Leave and Half Day cannot be recorded on these dates.",
      });
    const old = await get("attendance_adjustments", id);
    if (input.status === "Automatic")
      await remove("attendance_adjustments", id);
    else
      await put("attendance_adjustments", {
        ...input,
        status: input.status,
        id,
        recordedBy: req.user.id,
        createdAt: new Date().toISOString(),
      });
    await event(
      "audit_logs",
      req.user.id,
      "Attendance day status updated",
      `${employee.name}: ${input.date}`,
      { oldValue: old?.status || "Automatic", newValue: input },
    );
    res.json({ ok: true });
  }),
);
api.get(
  "/state",
  route(async (req, res) =>
    res.json({ ...(await snapshot(req.user)), csrf: req.authSession.csrf }),
  ),
);
api.post(
  "/auth/logout",
  route(async (req, res) => {
    if (req.user.role === "employee") {
      const a = (await all("attendance")).find(
        (a) =>
          a.employeeId === req.user.id && a.date === day() && !a.logoutTime,
      );
      if (a) await closeSession(a.id);
    }
    await remove("sessions", req.authSession.id);
    res.clearCookie("wp_session", cookie);
    res.json({ ok: true });
  }),
);
api.post(
  "/attendance/check-in",
  route(async (req, res) => {
    if (isWeekend(day()))
      return res.status(400).json({
        error:
          "Today is a weekly off. No attendance or working hours are required.",
      });
    if (req.user.role !== "employee")
      return res
        .status(400)
        .json({ error: "Attendance is for employee accounts." });
    if (Date.now() >= at(day(), (await settings()).endTime).getTime())
      return res.status(400).json({ error: "The working day has ended." });
    await checkIn(req.user.id, req.authSession.deviceId);
    res.json({ ok: true });
  }),
);
api.post(
  "/attendance/:action",
  route(async (req, res) => {
    const a = (await all("attendance")).find(
      (a) => a.employeeId === req.user.id && a.date === day() && !a.logoutTime,
    );
    if (!a)
      return res.status(400).json({ error: "No active attendance session." });
    if (req.params.action === "check-out") await closeSession(a.id);
    else if (req.params.action === "break") {
      if (a.breakStartedAt) {
        a.breakMinutes +=
          (Date.now() - new Date(a.breakStartedAt).getTime()) / 60000;
        a.breakStartedAt = null;
      } else a.breakStartedAt = new Date().toISOString();
      await put("attendance", a);
      await event(
        "audit_logs",
        req.user.id,
        a.breakStartedAt ? "Break started" : "Break ended",
        "Attendance break updated",
      );
    } else return res.sendStatus(404);
    res.json({ ok: true });
  }),
);
const employeeInput = z.object({
  name: z.string().min(2).max(100),
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase()),
  department: z.string().min(2).max(80),
  designation: z.string().min(2).max(80),
  phone: z.string().max(30).default(""),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  password: z.string().min(12).max(128),
});
api.post(
  "/employees",
  admin,
  route(async (req, res) => {
    const input = employeeInput.parse(req.body);
    if ((await all("employees")).some((e) => e.email === input.email))
      return res
        .status(409)
        .json({ error: "An employee with this email already exists." });
    const { password, ...data } = input;
    const employee = await put("employees", {
      ...data,
      id: randomUUID(),
      passwordHash: await bcrypt.hash(password, 12),
      employeeId: `WP-${randomUUID().slice(0, 8).toUpperCase()}`,
      role: "employee",
      status: "Active",
      color: "#e3ece5",
    });
    await event("audit_logs", req.user.id, "Employee created", employee.name);
    res.status(201).json({ id: employee.id });
  }),
);
api.patch(
  "/employees/:id",
  admin,
  route(async (req, res) => {
    const e = await get("employees", req.params.id);
    if (!e || e.role === "admin")
      return res.status(404).json({ error: "Employee not found." });
    const patch = z
      .object({
        name: z.string().min(2).max(100).optional(),
        department: z.string().min(2).max(80).optional(),
        designation: z.string().min(2).max(80).optional(),
        phone: z.string().max(30).optional(),
        status: z.enum(["Active", "Inactive"]).optional(),
      })
      .parse(req.body);
    await put("employees", { ...e, ...patch });
    if (patch.status === "Inactive") await revokeSessions(e.id);
    await event("audit_logs", req.user.id, "Employee updated", e.name, {
      oldValue: { status: e.status, name: e.name },
      newValue: patch,
    });
    res.json({ ok: true });
  }),
);
api.delete(
  "/employees/:id",
  admin,
  route(async (req, res) => {
    const e = await get("employees", req.params.id);
    if (!e || e.role === "admin")
      return res.status(404).json({ error: "Employee not found." });
    await revokeSessions(e.id);
    for (const d of await all("devices"))
      if (d.employeeId === e.id)
        await put("devices", { ...d, status: "Revoked" });
    await remove("employees", e.id);
    await event(
      "audit_logs",
      req.user.id,
      "Employee deleted",
      `${e.name}; historical records retained for audit.`,
    );
    res.json({ ok: true });
  }),
);
api.patch(
  "/devices/:id",
  admin,
  route(async (req, res) => {
    const status = z
        .enum(["Approved", "Rejected", "Revoked"])
        .parse(req.body.status),
      d = await get("devices", req.params.id);
    if (!d) return res.sendStatus(404);
    if (d.id === req.authSession.deviceId)
      return res
        .status(400)
        .json({ error: "You cannot revoke your current workstation." });
    await put("devices", { ...d, status });
    await event(
      "audit_logs",
      req.user.id,
      `Device ${status.toLowerCase()}`,
      d.name,
      { oldValue: d.status, newValue: status },
    );
    res.json({ ok: true });
  }),
);
api.post(
  "/projects",
  route(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(3).max(150),
        description: z.string().trim().max(3000).default(""),
        employeeId: z.string().optional(),
      })
      .parse(req.body);
    const owner =
      req.user.role === "admin" ? input.employeeId || req.user.id : req.user.id;
    const employee = await get("employees", owner);
    if (!employee || employee.status !== "Active")
      return res.status(400).json({ error: "Active employee required." });
    const project = await put("projects", {
      ...input,
      id: randomUUID(),
      employeeId: owner,
      createdAt: new Date().toISOString(),
    });
    await event("audit_logs", req.user.id, "Project created", project.name);
    res.status(201).json(project);
  }),
);
api.post(
  "/tasks",
  route(async (req, res) => {
    const input = z
      .object({
        projectId: z.string().min(1),
        title: z.string().min(3).max(150),
        description: z.string().trim().min(1).max(3000),
        estimatedMinutes: z.number().int().min(1).max(10080),
        priority: z.enum(["Low", "Medium", "High", "Critical"]),
        employeeId: z.string().optional(),
      })
      .parse(req.body);
    const project = await get("projects", input.projectId);
    if (
      !project ||
      (req.user.role !== "admin" && project.employeeId !== req.user.id)
    )
      return res.status(404).json({ error: "Project not found." });
    const owner = project.employeeId;
    if (!(await get("employees", owner)))
      return res.status(400).json({ error: "Employee not found." });
    const t = await put("tasks", {
      ...input,
      id: randomUUID(),
      employeeId: owner,
      actualMinutes: 0,
      startedAt: null,
      completedAt: null,
      status: "Pending",
      date: day(),
      comment: "",
      adminComment: "",
    });
    await event("audit_logs", owner, "Task created", t.title);
    res.status(201).json(t);
  }),
);
api.patch(
  "/tasks/:id",
  route(async (req, res) => {
    const t = await get("tasks", req.params.id);
    if (!t || (req.user.role !== "admin" && t.employeeId !== req.user.id))
      return res.status(404).json({ error: "Task not found." });
    const patch = z
      .object({
        status: z
          .enum(["Pending", "In Progress", "Completed", "Blocked"])
          .optional(),
        comment: z.string().max(3000).optional(),
        adminComment: z.string().max(3000).optional(),
      })
      .parse(req.body);
    if (patch.adminComment !== undefined && req.user.role !== "admin")
      return res.sendStatus(403);
    const old = t.status;
    if (patch.status && patch.status !== t.status) {
      t.startedAt = null;
      t.completedAt =
        patch.status === "Completed" ? new Date().toISOString() : null;
    }
    Object.assign(t, patch);
    await put("tasks", t);
    await event(
      "audit_logs",
      t.employeeId,
      "Task updated",
      `${t.title}: ${t.status}`,
      { oldValue: old, newValue: patch },
    );
    if (patch.status === "Blocked" || patch.status === "Completed")
      await event(
        "notifications",
        t.employeeId,
        `Task ${patch.status.toLowerCase()}`,
        t.title,
      );
    res.json({ ok: true });
  }),
);
api.post(
  "/tasks/:id/logs",
  route(async (req, res) => {
    const task = await get("tasks", req.params.id);
    if (
      !task ||
      !task.projectId ||
      (req.user.role !== "admin" && task.employeeId !== req.user.id)
    )
      return res.status(404).json({ error: "Task not found." });
    const input = z
      .object({
        id: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine((d) => {
            const parsed = at(d, "12:00");
            return (
              !Number.isNaN(parsed.getTime()) && day(parsed) === d && d <= day()
            );
          }, "Enter a valid date no later than today."),
        minutes: z.number().int().min(1).max(1440),
        details: z.string().trim().min(1).max(3000),
      })
      .parse(req.body);
    const previous = await get("work_logs", input.id);
    if (previous) {
      if (
        previous.taskId !== task.id ||
        previous.recordedBy !== req.user.id ||
        previous.date !== input.date ||
        previous.minutes !== input.minutes ||
        previous.details !== input.details
      )
        return res
          .status(409)
          .json({ error: "This work-log ID has already been used." });
      return res.json(previous);
    }
    const owner = await get("employees", task.employeeId);
    if (!owner || input.date < owner.joiningDate)
      return res
        .status(400)
        .json({
          error: "Work date cannot precede the employee's joining date.",
        });
    const total = (await all("work_logs"))
      .filter((l) => l.employeeId === task.employeeId && l.date === input.date)
      .reduce((sum, l) => sum + l.minutes, 0);
    if (total + input.minutes > 1440)
      return res
        .status(400)
        .json({ error: "Total logged time cannot exceed 24 hours in a day." });
    const log = await put("work_logs", {
      ...input,
      employeeId: task.employeeId,
      projectId: task.projectId,
      taskId: task.id,
      recordedBy: req.user.id,
      createdAt: new Date().toISOString(),
      source: "manual",
    });
    await event(
      "audit_logs",
      req.user.id,
      "Work logged",
      `${task.title}: ${input.minutes} minutes on ${input.date}`,
    );
    res.status(201).json(log);
  }),
);
api.post(
  "/reports/daily",
  route(async (req, res) => {
    const input = z
      .object({
        summary: z.string().min(10).max(5000),
        blockers: z.string().max(2000).default(""),
      })
      .parse(req.body);
    await put("daily_reports", {
      id: `${req.user.id}-${day()}`,
      employeeId: req.user.id,
      date: day(),
      ...input,
      createdAt: new Date().toISOString(),
    });
    await event(
      "audit_logs",
      req.user.id,
      "Daily report submitted",
      input.summary.slice(0, 150),
    );
    res.json({ ok: true });
  }),
);
api.get(
  "/reports/monthly",
  route(async (req, res) => {
    const month = z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .parse(req.query.month);
    const employeeId =
      req.user.role === "admin"
        ? z.string().parse(req.query.employeeId)
        : req.user.id;
    await event(
      "audit_logs",
      req.user.id,
      "Monthly report viewed",
      `${employeeId}: ${month}`,
    );
    res.json(await monthly(employeeId, month));
  }),
);
api.patch(
  "/security/:id",
  admin,
  route(async (req, res) => {
    const e = await get("security_events", req.params.id);
    if (!e) return res.sendStatus(404);
    await put("security_events", { ...e, status: "Reviewed" });
    await event("audit_logs", req.user.id, "Security event reviewed", e.title);
    res.json({ ok: true });
  }),
);
api.patch(
  "/notifications/:id",
  route(async (req, res) => {
    const n = await get("notifications", req.params.id);
    if (!n || (req.user.role !== "admin" && n.employeeId !== req.user.id))
      return res.sendStatus(404);
    await put("notifications", { ...n, status: "Read" });
    res.json({ ok: true });
  }),
);
api.put(
  "/settings",
  admin,
  route(async (req, res) => {
    const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    const input = z
      .object({
        startTime: time,
        lateThreshold: time,
        endTime: time,
        requiredHours: z.number().min(1).max(16),
        breakMinutes: z.number().int().min(0).max(180),
        workingDays: z.array(z.number().int().min(1).max(5)).min(1),
        holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
        alertThreshold: z.number().int().min(0).max(240),
      })
      .refine(
        (s) => s.startTime <= s.lateThreshold && s.lateThreshold < s.endTime,
        { message: "Start time must precede the late threshold and end time." },
      )
      .parse(req.body);
    const old = await settings();
    await put("settings", { id: "company", ...input });
    await event(
      "audit_logs",
      req.user.id,
      "Company settings changed",
      "Attendance policy updated",
      { oldValue: old, newValue: input },
    );
    res.json({ ok: true });
  }),
);
