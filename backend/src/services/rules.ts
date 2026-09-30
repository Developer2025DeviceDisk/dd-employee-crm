import type { Attendance, Settings } from "../models/types.js";
export const defaultSettings: Settings = {
  id: "company",
  startTime: "10:00",
  lateThreshold: "10:15",
  endTime: "19:00",
  requiredHours: 9,
  breakMinutes: 0,
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  alertThreshold: 0,
};
// Company policy uses Asia/Kolkata, independent of the server's operating-system timezone.
export function day(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function at(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`);
}
export function late(login: Date, settings: Settings) {
  return login.getTime() > at(day(login), settings.lateThreshold).getTime();
}
export function isWeekend(date: string) {
  const weekday = at(date, "12:00").getUTCDay();
  return weekday === 0 || weekday === 6;
}
export function working(a: Attendance, settings: Settings, now = new Date()) {
  const end = Math.min(
    new Date(a.logoutTime || now).getTime(),
    at(a.date, settings.endTime).getTime(),
  );
  const sessionMinutes = Math.max(
    0,
    (end - new Date(a.loginTime).getTime()) / 60000,
  );
  const breakMinutes =
    a.breakMinutes +
    (a.breakStartedAt
      ? Math.max(0, (end - new Date(a.breakStartedAt).getTime()) / 60000)
      : 0);
  const effectiveMinutes = Math.max(0, sessionMinutes - breakMinutes);
  return {
    sessionMinutes: Math.floor(sessionMinutes),
    breakMinutes: Math.floor(breakMinutes),
    effectiveMinutes: isWeekend(a.date) ? 0 : Math.floor(effectiveMinutes),
    requiredMinutes: isWeekend(a.date) ? 0 : settings.requiredHours * 60,
    difference: isWeekend(a.date)
      ? 0
      : Math.floor(effectiveMinutes - settings.requiredHours * 60),
  };
}
export function workDates(month: string, settings: Settings, now = new Date()) {
  const result: string[] = [];
  const today = day(now);
  for (let n = 1; n <= 31; n++) {
    const d = `${month}-${String(n).padStart(2, "0")}`;
    const date = at(d, "12:00");
    if (day(date) !== d || d > today) continue;
    if (
      !isWeekend(d) &&
      settings.workingDays.includes(date.getUTCDay()) &&
      !settings.holidays.includes(d)
    )
      result.push(d);
  }
  return result;
}
