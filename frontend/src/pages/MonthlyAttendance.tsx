import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  api,
  download,
  duration,
  time,
  type State,
  type Entry,
} from "../services/api";
import { Badge, Empty } from "../components/ui";

type CalendarDay = {
  date: string;
  status: string;
  isWorkingDay: boolean;
  isDue: boolean;
  isFuture: boolean;
  attendance: (Entry & { breakMinutes: number }) | null;
  reason: string;
  recordedStatus: "Leave" | "Half Day" | null;
};
type MonthReport = {
  month: string;
  today: string;
  employeeId: string;
  days: CalendarDay[];
  summary: {
    workingDays: number;
    elapsedWorkingDays: number;
    present: number;
    absent: number;
    late: number;
    leaves: number;
    halfDays: number;
    attendancePercentage: number;
    actualMinutes: number;
  };
};
const colors: Record<string, string> = {
  Present: "present",
  Late: "late",
  Absent: "absent",
  "Half Day": "half",
  Leave: "leave",
  Holiday: "off",
  "Weekly Off": "off",
  Upcoming: "upcoming",
  "Not checked in": "upcoming",
  "Not joined": "upcoming",
};
function shiftMonth(month: string, offset: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function MonthlyAttendance({ state }: { state: State }) {
  const admin = state.user.role === "admin";
  const people = state.employees.filter((e) => e.role === "employee");
  const [month, setMonth] = useState(state.today.slice(0, 7));
  const [employeeId, setEmployeeId] = useState(
    admin ? people[0]?.id || "" : state.user.id,
  );
  const [selected, setSelected] = useState(state.today);
  const [report, setReport] = useState<MonthReport | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Automatic"),
    [reason, setReason] = useState("");
  useEffect(() => {
    setSelected(
      month === state.today.slice(0, 7) ? state.today : `${month}-01`,
    );
  }, [month, employeeId]);
  useEffect(() => {
    let active = true;
    if (!employeeId) return;
    setLoading(true);
    setError("");
    api<MonthReport>(
      `/attendance/monthly?month=${month}&employeeId=${encodeURIComponent(employeeId)}`,
    )
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((e) => {
        if (active) {
          setReport(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, employeeId, reload, state.serverTime]);
  const current =
    report?.month === month && report.employeeId === employeeId ? report : null;
  const selectedDay = current?.days.find((d) => d.date === selected);
  useEffect(() => {
    setStatus(selectedDay?.recordedStatus || "Automatic");
    setReason(selectedDay?.reason || "");
  }, [selected, selectedDay?.recordedStatus, selectedDay?.reason]);
  const title = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const summary = current?.summary;
  const firstWeekday = (new Date(`${month}-01T12:00:00`).getDay() + 6) % 7;
  const a = selectedDay?.attendance;
  return (
    <div className="monthly-attendance">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Monthly attendance</h2>
            <p>
              Your complete month, with daily attendance and working hours. All
              times in IST.
            </p>
          </div>
          <button
            className="button"
            disabled={!current || loading}
            onClick={() =>
              current &&
              download(`attendance-${employeeId}-${month}.csv`, [
                [
                  "Employee",
                  people.find((p) => p.id === employeeId)?.name ||
                    state.user.name,
                ],
                ["Month", month],
                ["Working days", current.summary.workingDays],
                ["Working days counted", current.summary.elapsedWorkingDays],
                [
                  "Present (including late and half days)",
                  current.summary.present,
                ],
                ["Absent", current.summary.absent],
                ["Late entries", current.summary.late],
                ["Leave days", current.summary.leaves],
                ["Half days", current.summary.halfDays],
                ["Attendance percentage", current.summary.attendancePercentage],
                [],
                [
                  "Date",
                  "Status",
                  "Working day",
                  "Login",
                  "Logout",
                  "Effective minutes",
                  "Break minutes",
                  "Note",
                ],
                ...current.days.map((d) => [
                  d.date,
                  d.status,
                  d.isWorkingDay ? "Yes" : "No",
                  time(d.attendance?.loginTime),
                  time(d.attendance?.logoutTime),
                  d.attendance?.effectiveMinutes ?? "",
                  d.attendance?.breakMinutes ?? "",
                  d.reason,
                ]),
              ])
            }
          >
            <Download size={15} />
            Export month
          </button>
        </div>
        <div className="monthly-controls">
          <div className="month-picker">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <label>
              <CalendarDays size={16} />
              <input
                type="month"
                aria-label="Attendance month"
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
                    setMonth(e.target.value);
                }}
              />
            </label>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {admin && (
            <label className="monthly-employee">
              Employee
              <select
                aria-label="Attendance employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="text-button"
            onClick={() => setMonth(state.today.slice(0, 7))}
          >
            This month
          </button>
        </div>
        {!employeeId ? (
          <Empty
            title="No employees yet"
            detail="Add a team member to view monthly attendance."
          />
        ) : error ? (
          <div className="empty" role="alert">
            <p>{error}</p>
            <button className="button" onClick={() => setReload((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : !current ? (
          <div className="empty" role="status">
            Loading the month…
          </div>
        ) : (
          <>
            <div
              className="monthly-stats"
              aria-label="Monthly attendance summary"
            >
              {[
                ["Working days", summary!.workingDays],
                ["Present days", summary!.present],
                ["Absent days", summary!.absent],
                ["Late entries", summary!.late],
                ["Leave days", summary!.leaves],
                ["Half days", summary!.halfDays],
                ["Attendance", `${summary!.attendancePercentage}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="monthly-explanation">
              Totals through today: {summary!.elapsedWorkingDays} working days
              counted. Present includes late and half days; each half day earns
              0.5 attendance credit. Leave earns no attendance credit. Upcoming
              days, holidays, weekly offs, and days before joining are excluded
              from the percentage.
            </p>
            <div className="calendar-heading">
              <h3>{title}</h3>
              <span aria-live="polite">
                {loading
                  ? "Refreshing…"
                  : `${duration(summary!.actualMinutes)} worked`}
              </span>
            </div>
            <div className="attendance-legend">
              {[
                "Present",
                "Absent",
                "Late",
                "Half Day",
                "Leave",
                "Holiday",
                "Upcoming",
              ].map((s) => (
                <span key={s}>
                  <i className={`day-${colors[s]}`} />
                  {s}
                </span>
              ))}
            </div>
            <div
              className="attendance-calendar"
              aria-label={`${title} attendance calendar`}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                <div className="calendar-weekday" key={w}>
                  {w}
                </div>
              ))}
              {Array.from({ length: firstWeekday }, (_, i) => (
                <div
                  className="calendar-spacer"
                  key={`empty-${i}`}
                  aria-hidden="true"
                />
              ))}
              {current.days.map((d) => (
                <button
                  key={d.date}
                  className={`calendar-day day-${colors[d.status]} ${selected === d.date ? "selected-day" : ""}`}
                  aria-pressed={selected === d.date}
                  aria-label={`${d.date}: ${d.status}${d.attendance ? `, ${duration(d.attendance.effectiveMinutes)} worked` : ""}`}
                  onClick={() => setSelected(d.date)}
                >
                  <span className="calendar-date">
                    {Number(d.date.slice(-2))}
                    {d.date === state.today && <small>Today</small>}
                  </span>
                  <strong>{d.status}</strong>
                  <span className="calendar-hours">
                    {d.attendance
                      ? duration(d.attendance.effectiveMinutes)
                      : d.isFuture && d.recordedStatus
                        ? "Scheduled"
                        : d.status === "Not checked in"
                          ? "Day in progress"
                          : "—"}
                  </span>
                  {d.status === "Half Day" &&
                    d.attendance?.status === "Late" && (
                      <small>Late entry</small>
                    )}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      {current && selectedDay && (
        <section className="panel selected-day-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {new Date(`${selected}T12:00:00`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <p>
                Select any day above to inspect it. Your monthly overview stays
                visible.
              </p>
            </div>
            <Badge
              tone={
                ["Present", "Leave"].includes(selectedDay.status)
                  ? "green"
                  : selectedDay.status === "Absent"
                    ? "red"
                    : "amber"
              }
            >
              {selectedDay.status}
            </Badge>
          </div>
          {a ? (
            <div className="day-session-details">
              {[
                ["Check-in", time(a.loginTime)],
                [
                  "Check-out",
                  a.logoutTime ? time(a.logoutTime) : "Session open",
                ],
                ["Effective hours", duration(a.effectiveMinutes)],
                ["Breaks", duration(a.breakMinutes)],
                ["Required", duration(a.requiredMinutes)],
                [
                  "Difference",
                  `${a.difference < 0 ? "−" : "+"}${duration(Math.abs(a.difference))}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="day-no-session">
              {selectedDay.status === "Upcoming"
                ? "This date has not occurred yet."
                : selectedDay.status === "Not checked in"
                  ? "No check-in yet. Today is not counted as absent until the working day ends."
                  : "No attendance session recorded for this date."}
            </p>
          )}
          {selectedDay.reason && (
            <p className="day-no-session">Admin note: {selectedDay.reason}</p>
          )}
          {admin &&
            selectedDay.status !== "Not joined" &&
            selectedDay.status !== "Weekly Off" && (
              <form
                className="day-status-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  setError("");
                  try {
                    await api("/attendance/day-status", "PUT", {
                      employeeId,
                      date: selected,
                      status,
                      reason,
                    });
                    setReload((n) => n + 1);
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <label>
                  Recorded day status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option>Automatic</option>
                    <option>Leave</option>
                    <option>Half Day</option>
                  </select>
                </label>
                <label>
                  Admin note
                  <input
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional reason"
                  />
                </label>
                <button className="button primary" disabled={saving || loading}>
                  {saving ? "Saving…" : "Save day status"}
                </button>
                <p>
                  Automatic uses the recorded session and company calendar.
                  Leave and Half Day are explicit admin records.
                </p>
              </form>
            )}
        </section>
      )}
    </div>
  );
}
