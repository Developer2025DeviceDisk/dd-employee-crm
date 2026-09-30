import { test } from "node:test";
import assert from "node:assert/strict";
import {
  at,
  day,
  late,
  working,
  workDates,
  defaultSettings as s,
} from "../src/services/rules.js";
import type { Attendance, Task } from "../src/models/types.js";
import { monthlyAttendance } from "../src/services/monthly-attendance.js";
import { dailyWork } from "../src/services/projects.js";
import type { WorkLog } from "../src/models/types.js";
test("weekends remain off despite seven-day settings and historical sessions or leave", () => {
  const policy = { ...s, workingDays: [0, 1, 2, 3, 4, 5, 6] };
  const record = (date: string): Attendance => ({
    id: date,
    employeeId: "e",
    date,
    loginTime: at(date, "10:00").toISOString(),
    logoutTime: at(date, "19:00").toISOString(),
    deviceId: "d",
    status: "Late",
    breakMinutes: 0,
    breakStartedAt: null,
    autoClosed: false,
  });
  const sessions = [record("2026-09-05"), record("2026-09-06")];
  for (const session of sessions) {
    const hours = working(session, policy);
    assert.equal(hours.effectiveMinutes, 0);
    assert.equal(hours.requiredMinutes, 0);
    assert.equal(hours.difference, 0);
    assert.equal(hours.sessionMinutes, 540);
  }
  assert.deepEqual(workDates("2026-09", policy, at("2026-09-06", "20:00")), [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
  ]);
  const base = monthlyAttendance(
    "2026-09",
    "2026-09-01",
    [],
    [],
    policy,
    at("2026-09-06", "20:00"),
  );
  const result = monthlyAttendance(
    "2026-09",
    "2026-09-01",
    sessions,
    [
      {
        id: "old-leave",
        employeeId: "e",
        date: "2026-09-05",
        status: "Leave",
        reason: "Legacy entry",
        recordedBy: "admin",
        createdAt: "",
      },
    ],
    policy,
    at("2026-09-06", "20:00"),
  );
  assert.deepEqual(result.summary, base.summary);
  assert.equal(result.days[4].status, "Weekly Off");
  assert.equal(result.days[5].status, "Weekly Off");
  assert.equal(result.summary.workingDays, 22);
  assert.equal(result.summary.absent, 4);
  assert.equal(result.summary.actualMinutes, 0);
});
test("monthly overview includes every day, distinguishes calendar statuses, and weights half days", () => {
  const record = (date: string, status: "On time" | "Late"): Attendance => ({
    id: date,
    employeeId: "e",
    date,
    loginTime: at(date, "10:00").toISOString(),
    logoutTime: at(date, "19:00").toISOString(),
    breakMinutes: 0,
    breakStartedAt: null,
    deviceId: "d",
    status,
    autoClosed: false,
  });
  const records = [
    record("2026-09-02", "On time"),
    record("2026-09-03", "Late"),
    record("2026-09-05", "On time"),
  ];
  const adjustments = [
    {
      id: "half",
      employeeId: "e",
      date: "2026-09-03",
      status: "Half Day" as const,
      reason: "Approved half day",
      recordedBy: "admin",
      createdAt: "",
    },
    {
      id: "leave",
      employeeId: "e",
      date: "2026-09-07",
      status: "Leave" as const,
      reason: "Approved leave",
      recordedBy: "admin",
      createdAt: "",
    },
  ];
  const result = monthlyAttendance(
    "2026-09",
    "2026-09-02",
    records,
    adjustments,
    { ...s, holidays: ["2026-09-04"] },
    at("2026-09-08", "13:00"),
  );
  assert.equal(result.days.length, 30);
  const status = (date: string) =>
    result.days.find((d) => d.date === date)?.status;
  assert.equal(status("2026-09-01"), "Not joined");
  assert.equal(status("2026-09-02"), "Present");
  assert.equal(status("2026-09-03"), "Half Day");
  assert.equal(status("2026-09-04"), "Holiday");
  assert.equal(status("2026-09-06"), "Weekly Off");
  assert.equal(status("2026-09-07"), "Leave");
  assert.equal(status("2026-09-08"), "Not checked in");
  assert.equal(status("2026-09-09"), "Upcoming");
  assert.equal(result.summary.workingDays, 20);
  assert.equal(result.summary.elapsedWorkingDays, 3);
  assert.equal(result.summary.present, 2);
  assert.equal(result.summary.absent, 0);
  assert.equal(result.summary.halfDays, 1);
  assert.equal(result.summary.late, 1);
  assert.equal(result.summary.leaves, 1);
  assert.equal(result.summary.attendancePercentage, 50);
  const closed = monthlyAttendance(
    "2026-09",
    "2026-09-02",
    records,
    adjustments,
    { ...s, holidays: ["2026-09-04"] },
    at("2026-09-08", "19:00"),
  );
  assert.equal(closed.summary.absent, 1);
  assert.equal(closed.summary.attendancePercentage, 37.5);
});
test("month lengths and wholly future months never create false absences", () => {
  for (const [month, count] of [
    ["2024-02", 29],
    ["2026-02", 28],
    ["2026-10", 31],
  ] as const) {
    const result = monthlyAttendance(
      month,
      "2020-01-01",
      [],
      [],
      s,
      at("2020-01-01", "12:00"),
    );
    assert.equal(result.days.length, count);
    assert.equal(result.summary.absent, 0);
    assert.equal(result.summary.elapsedWorkingDays, 0);
    assert.equal(result.summary.attendancePercentage, 0);
  }
});
test("an open short session is present, not an inferred half day", () => {
  const record: Attendance = {
    id: "today",
    employeeId: "e",
    date: "2026-09-28",
    loginTime: at("2026-09-28", "10:00").toISOString(),
    logoutTime: null,
    breakMinutes: 0,
    breakStartedAt: null,
    deviceId: "d",
    status: "On time",
    autoClosed: false,
  };
  const report = monthlyAttendance(
    "2026-09",
    "2026-09-28",
    [record],
    [],
    s,
    at("2026-09-28", "11:00"),
  );
  assert.equal(report.days[27].status, "Present");
  assert.equal(report.summary.halfDays, 0);
  assert.equal(report.summary.attendancePercentage, 100);
});
const attendance = (
  login: string,
  logout: string | null,
  breakMinutes = 0,
): Attendance => ({
  id: "a",
  employeeId: "e",
  date: "2026-09-28",
  loginTime: at("2026-09-28", login).toISOString(),
  logoutTime: logout ? at("2026-09-28", logout).toISOString() : null,
  breakMinutes,
  breakStartedAt: null,
  deviceId: "d",
  status: "On time",
  autoClosed: false,
});
test("India date and exact late threshold do not depend on server timezone", () => {
  assert.equal(day(new Date("2026-09-27T20:00:00Z")), "2026-09-28");
  assert.equal(late(at("2026-09-28", "09:55"), s), false);
  assert.equal(late(at("2026-09-28", "10:15"), s), false);
  assert.equal(
    late(new Date(at("2026-09-28", "10:15").getTime() + 1000), s),
    true,
  );
});
test("actual durations and shortfall are calculated rather than assuming nine hours", () => {
  assert.equal(working(attendance("10:05", "19:00"), s).effectiveMinutes, 535);
  assert.equal(working(attendance("10:15", "19:00"), s).difference, -15);
  assert.equal(working(attendance("09:58", "19:00"), s).difference, 2);
  assert.equal(
    working(attendance("10:00", "19:00", 60), s).effectiveMinutes,
    480,
  );
});
test("open sessions stop at scheduled close and active breaks are bounded", () => {
  const a = attendance("10:00", null, 30);
  a.breakStartedAt = at(a.date, "18:30").toISOString();
  const result = working(a, s, at(a.date, "22:00"));
  assert.equal(result.sessionMinutes, 540);
  assert.equal(result.breakMinutes, 60);
  assert.equal(result.effectiveMinutes, 480);
});
test("configured later close permits overtime", () => {
  assert.equal(
    working(attendance("10:00", "19:30"), { ...s, endTime: "20:00" })
      .difference,
    30,
  );
});
test("daily work adds logs across projects, requires eight hours, and excludes days off", () => {
  const log = (
    minutes: number,
    projectId: string,
    date = "2026-09-28",
    employeeId = "e",
  ) => ({ minutes, projectId, date, employeeId }) as WorkLog;
  const logs = [
    log(120, "a"),
    log(180, "b"),
    log(179, "c"),
    log(300, "a", "2026-09-29"),
    log(400, "a", "2026-09-28", "other"),
  ];
  let result = dailyWork("e", "2026-09-28", logs, s);
  assert.equal(result.loggedMinutes, 479);
  assert.equal(result.requiredMinutes, 480);
  assert.equal(result.remainingMinutes, 1);
  assert.equal(result.status, "Incomplete");
  logs.push(log(1, "d"));
  result = dailyWork("e", "2026-09-28", logs, s);
  assert.equal(result.status, "Completed");
  assert.equal(result.remainingMinutes, 0);
  for (const date of ["2026-09-26", "2026-09-27", "2026-09-30"]) {
    const off = dailyWork("e", date, [log(60, "a", date)], {
      ...s,
      holidays: ["2026-09-30"],
    });
    assert.equal(off.loggedMinutes, 60);
    assert.equal(off.countedMinutes, 0);
    assert.equal(off.requiredMinutes, 0);
    assert.equal(off.remainingMinutes, 0);
    assert.equal(off.status, "Day off");
  }
});
test("monthly working dates exclude weekends, holidays, and future dates", () => {
  const dates = workDates(
    "2026-09",
    { ...s, holidays: ["2026-09-02"] },
    at("2026-09-07", "12:00"),
  );
  assert.deepEqual(dates, [
    "2026-09-01",
    "2026-09-03",
    "2026-09-04",
    "2026-09-07",
  ]);
});
