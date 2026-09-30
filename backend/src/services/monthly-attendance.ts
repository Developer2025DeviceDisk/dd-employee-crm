import type {
  Attendance,
  AttendanceAdjustment,
  Settings,
} from "../models/types.js";
import { at, day, working, isWeekend } from "./rules.js";
export function monthlyAttendance(
  month: string,
  joiningDate: string,
  records: Attendance[],
  adjustments: AttendanceAdjustment[],
  settings: Settings,
  now = new Date(),
) {
  const today = day(now);
  const [year, number] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const beforeJoining = date < joiningDate;
    const holiday = settings.holidays.includes(date);
    const weeklyOff =
      isWeekend(date) ||
      !settings.workingDays.includes(at(date, "12:00").getUTCDay());
    const isWorkingDay = !beforeJoining && !holiday && !weeklyOff;
    const source = records.find((a) => a.date === date);
    const attendance = source
      ? { ...source, ...working(source, settings, now) }
      : null;
    const adjustment = adjustments.find((a) => a.date === date);
    const isFuture = date > today;
    const isDue =
      isWorkingDay &&
      !isFuture &&
      (date < today ||
        now >= at(date, settings.endTime) ||
        !!attendance ||
        !!adjustment);
    const status = beforeJoining
      ? "Not joined"
      : weeklyOff
        ? "Weekly Off"
        : adjustment?.status ||
          (attendance
            ? attendance.status === "Late"
              ? "Late"
              : "Present"
            : holiday
              ? "Holiday"
              : weeklyOff
                ? "Weekly Off"
                : isFuture
                  ? "Upcoming"
                  : isDue
                    ? "Absent"
                    : "Not checked in");
    return {
      date,
      status,
      isWorkingDay,
      isDue,
      isFuture,
      attendance,
      reason: adjustment?.reason || "",
      recordedStatus: adjustment?.status || null,
    };
  });
  const due = days.filter((d) => d.isDue);
  const present = due.filter((d) =>
    ["Present", "Late", "Half Day"].includes(d.status),
  ).length;
  const halfDays = due.filter((d) => d.status === "Half Day").length;
  const summary = {
    workingDays: days.filter((d) => d.isWorkingDay).length,
    elapsedWorkingDays: due.length,
    present,
    absent: due.filter((d) => d.status === "Absent").length,
    late: due.filter((d) => d.attendance?.status === "Late").length,
    leaves: due.filter((d) => d.status === "Leave").length,
    halfDays,
    attendancePercentage: due.length
      ? Math.round(((present - halfDays * 0.5) / due.length) * 1000) / 10
      : 0,
    actualMinutes: days
      .filter((d) => d.isDue)
      .reduce((sum, d) => sum + (d.attendance?.effectiveMinutes || 0), 0),
  };
  return { month, today, days, summary };
}
