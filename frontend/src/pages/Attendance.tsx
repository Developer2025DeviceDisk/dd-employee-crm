import { useState } from "react";
import { Search, Download } from "lucide-react";
import {
  duration,
  isWeekend,
  time,
  download,
  type State,
  type Person,
} from "../services/api";
import { Badge, Avatar, Empty, SearchBox } from "../components/ui";
import { Login } from "./Login";
import { MonthlyAttendance } from "./MonthlyAttendance";
export function Attendance(props: Parameters<typeof DailyAttendance>[0]) {
  const [view, setView] = useState<"daily" | "monthly">("daily");
  if (props.state.user.role === "employee")
    return <MonthlyAttendance state={props.state} />;
  return (
    <>
      <div
        className="button-row attendance-view-toggle"
        aria-label="Attendance view"
      >
        <button
          className={`button ${view === "daily" ? "primary" : ""}`}
          onClick={() => setView("daily")}
        >
          Daily team view
        </button>
        <button
          className={`button ${view === "monthly" ? "primary" : ""}`}
          onClick={() => setView("monthly")}
        >
          Monthly employee view
        </button>
      </div>
      {view === "monthly" ? (
        <MonthlyAttendance state={props.state} />
      ) : (
        <DailyAttendance {...props} />
      )}
    </>
  );
}
function DailyAttendance({
  state,
  search,
  setSearch,
  onSelect,
}: {
  state: State;
  search: string;
  setSearch: (s: string) => void;
  onSelect: (p: Person) => void;
}) {
  const [date, setDate] = useState(state.today),
    [filter, setFilter] = useState("All statuses");
  const weeklyOff = isWeekend(date);
  const people = state.employees.filter(
    (p) =>
      p.role === "employee" &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const rows = people
    .map((p) => ({
      p,
      a: state.attendance.find((a) => a.employeeId === p.id && a.date === date),
    }))
    .filter(
      ({ a }) =>
        filter === "All statuses" ||
        (weeklyOff ? "Weekly Off" : a?.status || "Absent") === filter,
    );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Daily attendance</h2>
          <p>
            Actual sessions, measured against a {state.settings.requiredHours}
            -hour target. All times in IST.
          </p>
        </div>
        <button
          className="button"
          onClick={() =>
            download(`attendance-${date}.csv`, [
              [
                "Employee",
                "Date",
                "Login",
                "Logout",
                "Break minutes",
                "Effective minutes",
                "Difference minutes",
              ],
              ...rows.map(({ p, a }) => [
                p.name,
                date,
                time(a?.loginTime),
                time(a?.logoutTime),
                a?.breakMinutes || 0,
                a?.effectiveMinutes || 0,
                weeklyOff
                  ? 0
                  : (a?.difference ?? -state.settings.requiredHours * 60),
              ]),
            ])
          }
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
      <div className="table-toolbar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search employees…"
        />
        <div className="button-row">
          <input
            type="date"
            aria-label="Attendance date"
            value={date}
            max={state.today}
            onChange={(e) => setDate(e.target.value)}
          />
          <select
            aria-label="Attendance status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All statuses</option>
            <option>On time</option>
            <option>Late</option>
            <option>Absent</option>
            <option>Weekly Off</option>
          </select>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Login</th>
              <th>Logout</th>
              <th>Breaks</th>
              <th>Effective hours</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, a }) => (
              <tr key={p.id} onClick={() => onSelect(p)}>
                <td>
                  <div className="person-cell">
                    <Avatar person={p} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.employeeId}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <Badge
                    tone={
                      a?.status === "On time"
                        ? "green"
                        : a
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {weeklyOff ? "Weekly Off" : a?.status || "Absent"}
                  </Badge>
                </td>
                <td>{time(a?.loginTime)}</td>
                <td>
                  {a?.logoutTime ? (
                    time(a.logoutTime)
                  ) : a ? (
                    <Badge tone="green">Working</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{a ? duration(a.breakMinutes) : "—"}</td>
                <td>
                  <strong>{a ? duration(a.effectiveMinutes) : "—"}</strong>
                </td>
                <td className={(a?.difference || 0) < 0 ? "amber" : "green"}>
                  {a
                    ? `${a.difference >= 0 ? "+" : "−"}${duration(Math.abs(a.difference))}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title="No matching records"
            detail="Try another employee or attendance status."
          />
        )}
      </div>
    </section>
  );
}
