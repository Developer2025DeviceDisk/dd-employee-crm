import { randomUUID } from "node:crypto";
import { all, get, put } from "../models/store.js";
import {
  at,
  day,
  taskMinutes,
  working,
  workDates,
  defaultSettings,
} from "./rules.js";
import type { Event, Employee } from "../models/types.js";
import { monthlyAttendance } from "./monthly-attendance.js";
import { revokeSessions } from "../middleware/auth.js";
export async function settings() {
  const value = (await get("settings", "company")) || defaultSettings;
  return {
    ...value,
    workingDays: value.workingDays.filter((d) => d !== 0 && d !== 6),
  };
}
export async function event(
  table: "audit_logs" | "notifications" | "security_events",
  employeeId: string,
  type: string,
  description: string,
  meta: Partial<Event> = {},
) {
  return put(table, {
    id: randomUUID(),
    employeeId,
    type,
    title: type,
    description,
    createdAt: new Date().toISOString(),
    status: "Open",
    ip: "",
    device: "",
    ...meta,
  });
}
export async function notifyOnce(
  key: string,
  employeeId: string,
  type: string,
  description: string,
) {
  if (!(await get("notifications", key)))
    await event("notifications", employeeId, type, description, { id: key });
}
export async function closeSession(id: string, automatic = false) {
  const a = await get("attendance", id);
  if (!a || a.logoutTime) return;
  const s = await settings();
  const end = new Date(Math.min(Date.now(), at(a.date, s.endTime).getTime()));
  if (a.breakStartedAt)
    a.breakMinutes += Math.max(
      0,
      (end.getTime() - new Date(a.breakStartedAt).getTime()) / 60000,
    );
  a.breakStartedAt = null;
  a.logoutTime = end.toISOString();
  a.autoClosed = automatic;
  await put("attendance", a);
  await event(
    "audit_logs",
    a.employeeId,
    automatic ? "Automatic logout" : "Checked out",
    "Attendance session closed",
  );
  if (automatic) {
    await revokeSessions(a.employeeId);
    await notifyOnce(
      `logout-${id}`,
      a.employeeId,
      "Automatic logout",
      "Attendance closed at the configured end of day.",
    );
  }
}
export async function runJobs(now = new Date()) {
  const s = await settings(),
    today = day(now);
  for (const a of await all("attendance"))
    if (!a.logoutTime && now >= at(a.date, s.endTime))
      await closeSession(a.id, true);
  for (const t of await all("tasks"))
    if (
      t.status === "In Progress" &&
      taskMinutes(t, now) > t.estimatedMinutes + s.alertThreshold
    )
      await notifyOnce(
        `overrun-${t.id}`,
        t.employeeId,
        "Task estimate exceeded",
        `${t.title} needs review. An estimate overrun is not a performance assessment.`,
      );
  if (
    now >= at(today, s.endTime) &&
    workDates(today.slice(0, 7), s, now).includes(today)
  )
    for (const e of (await all("employees")).filter(
      (e) =>
        e.role === "employee" &&
        e.status === "Active" &&
        e.joiningDate <= today,
    )) {
      const attendance = (await all("attendance")).find(
        (a) => a.date === today && a.employeeId === e.id,
      );
      if (!attendance)
        await notifyOnce(
          `absent-${e.id}-${today}`,
          e.id,
          "Absent today",
          "No attendance session was recorded.",
        );
      else if (
        !(await all("daily_reports")).some(
          (r) => r.employeeId === e.id && r.date === today,
        )
      )
        await notifyOnce(
          `report-${e.id}-${today}`,
          e.id,
          "Daily report missing",
          "The daily work report has not been submitted.",
        );
    }
}
export function publicEmployee(e: Employee) {
  const { passwordHash, ...safe } = e;
  return safe;
}
export async function snapshot(user: Employee) {
  const s = await settings(),
    admin = user.role === "admin",
    scope = (x: { employeeId: string }) => admin || x.employeeId === user.id;
  return {
    user: publicEmployee(user),
    settings: s,
    today: day(),
    serverTime: new Date().toISOString(),
    demo:
      process.env.DEMO_MODE !== "false" &&
      process.env.NODE_ENV !== "production",
    employees: (await all("employees"))
      .filter((e) => admin || e.id === user.id)
      .map(publicEmployee),
    attendance: (await all("attendance"))
      .filter(scope)
      .map((a) => ({ ...a, ...working(a, s) })),
    tasks: (await all("tasks")).filter(scope).map((t) => ({
      ...t,
      elapsedMinutes: taskMinutes(t),
      isOverdue:
        t.status === "In Progress" &&
        taskMinutes(t) > t.estimatedMinutes + s.alertThreshold,
    })),
    devices: (await all("devices"))
      .filter(scope)
      .map(({ tokenHash, ...d }) => d),
    notifications: (await all("notifications"))
      .filter(scope)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    security: admin ? await all("security_events") : [],
    audit: (await all("audit_logs"))
      .filter(scope)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200),
    reports: (await all("daily_reports")).filter(scope),
  };
}
export async function monthly(employeeId: string, month: string) {
  const s = await settings(),
    employee = await get("employees", employeeId);
  const dates = workDates(month, s).filter(
    (d) => d >= (employee?.joiningDate || "0000"),
  );
  const rows = (await all("attendance"))
    .filter((a) => a.employeeId === employeeId && a.date.startsWith(month))
    .map((a) => ({ ...a, ...working(a, s) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const countedRows = rows.filter((a) => dates.includes(a.date));
  const actual = countedRows.reduce((v, a) => v + a.effectiveMinutes, 0);
  const present = dates.filter((d) => rows.some((r) => r.date === d)).length;
  const adjustments = (await all("attendance_adjustments")).filter(
    (a) => a.employeeId === employeeId && a.date.startsWith(month),
  );
  // Expand only the details table. Existing summary calculations remain unchanged.
  const calendarRows = monthlyAttendance(
    month,
    employee?.joiningDate || "0000",
    rows,
    adjustments,
    s,
  ).days.map((d) => ({
    date: d.date,
    loginTime: d.attendance?.loginTime || null,
    logoutTime: d.attendance?.logoutTime || null,
    status: d.status,
    effectiveMinutes:
      d.attendance?.effectiveMinutes ?? (d.status === "Absent" ? 0 : null),
    difference:
      d.attendance?.difference ??
      (d.status === "Absent" ? -s.requiredHours * 60 : null),
  }));
  return {
    employee: employee ? publicEmployee(employee) : null,
    month,
    rows,
    calendarRows,
    workingDays: dates.length,
    present,
    absent: dates.length - present,
    late: countedRows.filter((a) => a.status === "Late").length,
    requiredMinutes: dates.length * s.requiredHours * 60,
    actualMinutes: actual,
    difference: actual - dates.length * s.requiredHours * 60,
    averageMinutes: countedRows.length
      ? Math.round(actual / countedRows.length)
      : 0,
  };
}
