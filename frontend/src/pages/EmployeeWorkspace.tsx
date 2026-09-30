import {
  ClipboardList,
  Plus,
  Clock,
  Check,
  LogOut,
  CheckCircle2,
  Pause,
  Play,
  FileText,
} from "lucide-react";
import {
  duration,
  time,
  isWeekend,
  type Work,
  type Entry,
} from "../services/api";
import { Stat } from "../components/ui";
import { Attendance } from "./Attendance";
import { Tasks } from "./WorkMonitoring";
export function EmployeeHome({ state, busy, mutate, onTask, onReport }: any) {
  if (isWeekend(state.today))
    return (
      <section className="welcome-card">
        <div>
          <span className="eyebrow">TODAY'S ATTENDANCE</span>
          <h2>Today is a weekly off.</h2>
          <p>
            Saturday and Sunday have no attendance requirement, working-hour
            target, or shortfall.
          </p>
        </div>
      </section>
    );
  const a = state.attendance.find(
    (a: Entry) => a.employeeId === state.user.id && a.date === state.today,
  );
  return (
    <>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">TODAY'S ATTENDANCE</span>
          <h2>
            {a
              ? a.logoutTime
                ? "Your workday is complete."
                : a.breakStartedAt
                  ? "Take a moment to recharge."
                  : "You’re checked in. Let’s make progress."
              : "Ready when you are."}
          </h2>
          <p>
            {a
              ? `Checked in at ${time(a.loginTime)} · Scheduled close at ${state.settings.endTime} IST`
              : "Check in from your approved workstation to start your day."}
          </p>
        </div>
        <div className="button-row">
          {!a && (
            <button
              disabled={busy}
              className="button primary"
              onClick={() =>
                mutate("/attendance/check-in", "POST", {}, "Attendance started")
              }
            >
              <Play size={16} />
              Check in
            </button>
          )}
          {a && !a.logoutTime && (
            <>
              <button
                disabled={busy}
                className="button"
                onClick={() =>
                  mutate(
                    "/attendance/break",
                    "POST",
                    {},
                    a.breakStartedAt ? "Welcome back" : "Break started",
                  )
                }
              >
                <Pause size={16} />
                {a.breakStartedAt ? "End break" : "Take a break"}
              </button>
              <button
                disabled={busy}
                className="button primary"
                onClick={() =>
                  mutate(
                    "/attendance/check-out",
                    "POST",
                    {},
                    "Checked out for today",
                  )
                }
              >
                Check out <LogOut size={15} />
              </button>
            </>
          )}
          <button className="button" onClick={onReport}>
            <FileText size={16} />
            Daily report
          </button>
        </div>
      </section>
      <div className="stats-grid three">
        <Stat
          title="Effective working time"
          value={a ? Math.floor(a.effectiveMinutes / 60) : 0}
          icon={<Clock size={19} />}
          detail={a ? duration(a.effectiveMinutes) : "Not checked in"}
        />
        <Stat
          title="Daily target"
          value={state.settings.requiredHours}
          icon={<CheckCircle2 size={19} />}
          detail={`${a ? duration(Math.max(0, -a.difference)) : duration(state.settings.requiredHours * 60)} remaining`}
        />
        <Stat
          title="Tasks completed"
          value={
            state.tasks.filter(
              (t: Work) => t.status === "Completed" && t.date === state.today,
            ).length
          }
          icon={<ClipboardList size={19} />}
          detail={
            <button className="text-button" onClick={onTask}>
              Plan your next task <Plus size={13} />
            </button>
          }
        />
      </div>
    </>
  );
}
