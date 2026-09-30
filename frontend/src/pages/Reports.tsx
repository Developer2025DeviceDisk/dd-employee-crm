import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { api, duration, time, download, type State } from "../services/api";
import { Badge, Empty } from "../components/ui";
type CalendarRow = {
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  status: string;
  effectiveMinutes: number | null;
  difference: number | null;
};
export function Reports({
  state,
  notify,
}: {
  state: State;
  notify: (s: string) => void;
}) {
  const [month, setMonth] = useState(state.today.slice(0, 7)),
    [id, setId] = useState(
      state.user.role === "admin"
        ? state.employees.find((e) => e.role === "employee")?.id || ""
        : state.user.id,
    ),
    [report, setReport] = useState<any>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!id || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    setLoading(true);
    api(`/reports/monthly?employeeId=${encodeURIComponent(id)}&month=${month}`)
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((e) => {
        if (active) {
          setReport(null);
          notify(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, month]);
  const currentReport = report?.month === month && report.employee?.id === id;
  const attendanceRows: CalendarRow[] = [...(report?.calendarRows || [])].sort(
    (a, b) => b.date.localeCompare(a.date),
  );
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Monthly attendance report</h2>
            <p>
              Working days through today, excluding configured holidays and
              dates before joining.
            </p>
          </div>
          <button
            className="button primary"
            disabled={!currentReport || loading}
            onClick={() =>
              download(`monthly-${month}.csv`, [
                ["Employee", report.employee?.name],
                ["Working days", report.workingDays],
                ["Present", report.present],
                ["Absent", report.absent],
                ["Required minutes", report.requiredMinutes],
                ["Actual minutes", report.actualMinutes],
                [],
                [
                  "Date",
                  "Login",
                  "Logout",
                  "Status",
                  "Effective minutes",
                  "Difference minutes",
                ],
                ...attendanceRows.map((a) => [
                  a.date,
                  time(a.loginTime),
                  time(a.logoutTime),
                  a.status,
                  a.effectiveMinutes ?? "",
                  a.difference ?? "",
                ]),
              ])
            }
          >
            <Download size={16} />
            Download CSV
          </button>
        </div>
        <div className="report-filters">
          <label>
            Employee
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {state.employees
                .filter((e) => e.role === "employee")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Month
            <input
              type="month"
              max={state.today.slice(0, 7)}
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
        </div>
        {loading || (report && !currentReport) ? (
          <div className="empty">Preparing report…</div>
        ) : (
          report && (
            <>
              <div className="report-summary">
                {[
                  ["Working days", report.workingDays],
                  ["Present", report.present],
                  ["Absent", report.absent],
                  ["Late entries", report.late],
                  ["Average hours", duration(report.averageMinutes)],
                  [
                    "Total shortfall",
                    duration(Math.max(0, -report.difference)),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Login</th>
                      <th>Logout</th>
                      <th>Status</th>
                      <th>Working hours</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((a) => (
                      <tr key={a.date}>
                        <td>
                          {new Date(a.date + "T12:00:00").toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              weekday: "short",
                            },
                          )}
                        </td>
                        <td>{time(a.loginTime)}</td>
                        <td>{time(a.logoutTime)}</td>
                        <td>
                          <Badge
                            tone={
                              a.status === "Present"
                                ? "green"
                                : a.status === "Absent"
                                  ? "red"
                                  : ["Late", "Half Day"].includes(a.status)
                                    ? "amber"
                                    : a.status === "Leave"
                                      ? "blue"
                                      : "neutral"
                            }
                          >
                            {a.status}
                          </Badge>
                        </td>
                        <td>
                          {a.effectiveMinutes === null
                            ? "—"
                            : duration(a.effectiveMinutes)}
                        </td>
                        <td
                          className={
                            a.difference === null
                              ? "muted"
                              : a.difference < 0
                                ? "amber"
                                : "green"
                          }
                        >
                          {a.difference === null
                            ? "—"
                            : `${a.difference < 0 ? "−" : "+"}${duration(Math.abs(a.difference))}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!attendanceRows.length && (
                  <Empty
                    title="No attendance this month"
                    detail="Recorded sessions will appear here."
                  />
                )}
              </div>
              <div className="table-bottom">
                <span>
                  Required: {duration(report.requiredMinutes)} · Actual:{" "}
                  {duration(report.actualMinutes)}
                </span>
                <span>Timezone: Asia/Kolkata</span>
              </div>
            </>
          )
        )}
      </section>
      <section className="panel audit-panel">
        <div className="panel-heading">
          <h2>Daily work reports</h2>
        </div>
        {state.reports.filter(
          (r) => r.employeeId === id && r.date.startsWith(month),
        ).length ? (
          state.reports
            .filter((r) => r.employeeId === id && r.date.startsWith(month))
            .map((r) => (
              <div className="event-row" key={r.id}>
                <FileText size={22} />
                <div>
                  <h3>{r.date}</h3>
                  <p>{r.summary}</p>
                  {r.blockers && <small>Blockers: {r.blockers}</small>}
                </div>
              </div>
            ))
        ) : (
          <Empty
            title="No daily reports yet"
            detail="Employee work summaries for this month will appear here."
          />
        )}
      </section>
    </>
  );
}
