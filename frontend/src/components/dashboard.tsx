import { Activity, ChevronRight, Check } from "lucide-react";
import { duration, time, isWeekend, type State, type Person } from "../services/api";
import { Badge, Avatar, Empty } from "./ui";
import { Attendance } from "../pages/Attendance";
export function WeekChart({ state }: { state: State }) {
  const today = new Date(state.today + "T12:00:00");
  const offset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - offset);
  const days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const a = state.attendance.filter((a) => a.date === key);
    return {
      label: ["Mon", "Tue", "Wed", "Thu", "Fri"][i],
      key,
      onTime: a.filter((a) => a.status === "On time").length,
      late: a.filter((a) => a.status === "Late").length,
      future: key > state.today,
    };
  });
  const total =
    state.employees.filter(
      (e) => e.role === "employee" && e.status === "Active",
    ).length || 1;
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="legend-green" />
          On time
        </span>
        <span>
          <i className="legend-amber" />
          Late
        </span>
        <span>
          <i className="legend-gray" />
          Absent
        </span>
      </div>
      <div className="bar-chart">
        <div className="chart-y">
          <span>{total}</span>
          <span>{Math.round(total * 0.75)}</span>
          <span>{Math.round(total * 0.5)}</span>
          <span>{Math.round(total * 0.25)}</span>
          <span>0</span>
        </div>
        <div className="chart-grid">
          {days.map((d) => (
            <div
              className={
                "chart-column " + (d.key === state.today ? "today-column" : "")
              }
              key={d.key}
            >
              <div
                className="bar-track"
                title={`${d.label}: ${d.onTime} on time, ${d.late} late${d.future ? " · Upcoming day" : ""}`}
              >
                <div
                  className="bar-segment absent"
                  style={{
                    height: `${d.future ? 100 : (Math.max(0, total - d.onTime - d.late) / total) * 100}%`,
                    opacity: d.future ? 0.35 : 1,
                  }}
                />
                <div
                  className="bar-segment late"
                  style={{ height: `${(d.late / total) * 100}%` }}
                />
                <div
                  className="bar-segment ontime"
                  style={{ height: `${(d.onTime / total) * 100}%` }}
                />
              </div>
              <span>
                {d.label}
                {d.key === state.today && <i />}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-note">
        <span className="chart-note-icon">
          <Activity size={14} />
        </span>{" "}
        A clear picture of your team's week.<span>Mon – Fri · IST</span>
      </div>
    </>
  );
}

export function TeamTable({
  people,
  state,
  onSelect,
}: {
  people: Person[];
  state: State;
  onSelect: (p: Person) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Attendance</th>
            <th>Check-in</th>
            <th>Working hours</th>
            <th>Current task</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const a = state.attendance.find(
                (a) => a.employeeId === p.id && a.date === state.today,
              ),
              t = state.tasks.find(
                (t) => t.employeeId === p.id && t.date === state.today,
              );
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(p);
                }}
              >
                <td>
                  <div className="person-cell">
                    <Avatar person={p} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.department}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <Badge
                    tone={
                      !a ? "neutral" : a.status === "Late" ? "amber" : "green"
                    }
                  >
                    {isWeekend(state.today) ? 'Weekly Off' : a?.status || "Absent"}
                  </Badge>
                </td>
                <td className="mono">{time(a?.loginTime)}</td>
                <td>
                  <div className="hours-cell">
                    <strong>
                      {a ? duration(a.effectiveMinutes) : "—"}
                      <small> / {isWeekend(state.today) ? 0 : state.settings.requiredHours}h</small>
                    </strong>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${Math.min(100, ((a?.effectiveMinutes || 0) / (state.settings.requiredHours * 60)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="task-title-cell">
                  {t?.title || "No task planned"}
                </td>
                <td>
                  <Badge
                    tone={
                      t?.status === "Completed"
                        ? "green"
                        : t?.status === "Blocked"
                          ? "red"
                          : t?.isOverdue
                            ? "amber"
                            : t?.status === "In Progress"
                              ? "blue"
                              : "neutral"
                    }
                  >
                    {t?.isOverdue ? "Needs review" : t?.status || "Offline"}
                  </Badge>
                </td>
                <td>
                  <ChevronRight size={15} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!people.length && (
        <Empty
          title="No employees found"
          detail="Try another name or department."
        />
      )}
    </div>
  );
}
