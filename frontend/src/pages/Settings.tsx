import { ShieldCheck, Check } from "lucide-react";
import { time } from "../services/api";
import { Attendance } from "./Attendance";
export function SettingsForm({ state, busy, mutate }: any) {
  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <h2>Attendance & work policies</h2>
          <p>
            These rules are enforced by the server. Company timezone:
            Asia/Kolkata.
          </p>
        </div>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          mutate(
            "/settings",
            "PUT",
            {
              startTime: f.get("startTime"),
              lateThreshold: f.get("lateThreshold"),
              endTime: f.get("endTime"),
              requiredHours: Number(f.get("requiredHours")),
              breakMinutes: Number(f.get("breakMinutes")),
              alertThreshold: Number(f.get("alertThreshold")),
              workingDays: f.getAll("workingDays").map(Number),
              holidays: String(f.get("holidays"))
                .split(/[\s,]+/)
                .filter(Boolean),
            },
            "Company policies saved",
          );
        }}
      >
        <h3>Working schedule</h3>
        <div className="form-row three-col">
          <label>
            Office start
            <input
              type="time"
              name="startTime"
              required
              defaultValue={state.settings.startTime}
            />
          </label>
          <label>
            Late after
            <input
              type="time"
              name="lateThreshold"
              required
              defaultValue={state.settings.lateThreshold}
            />
          </label>
          <label>
            Automatic logout
            <input
              type="time"
              name="endTime"
              required
              defaultValue={state.settings.endTime}
            />
          </label>
        </div>
        <div className="form-row three-col">
          <label>
            Required hours per day
            <input
              type="number"
              name="requiredHours"
              min={1}
              max={16}
              step={0.25}
              defaultValue={state.settings.requiredHours}
            />
          </label>
          <label>
            Planned break (minutes)
            <input
              type="number"
              name="breakMinutes"
              min={0}
              max={180}
              defaultValue={state.settings.breakMinutes}
            />
          </label>
          <label>
            Task alert grace (minutes)
            <input
              type="number"
              name="alertThreshold"
              min={0}
              max={240}
              defaultValue={state.settings.alertThreshold}
            />
          </label>
        </div>
        <p className="muted small-text">
          Planned breaks are guidance only. Effective hours subtract actual
          recorded breaks.
        </p>
        <h3>Working days</h3>
        <p className="muted small-text">
          Saturday and Sunday are fixed weekly offs and cannot be selected.
        </p>
        <div className="weekday-options">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <label key={d}>
              <input
                type="checkbox"
                name="workingDays"
                value={i}
                disabled={i === 0 || i === 6}
                defaultChecked={
                  i !== 0 && i !== 6 && state.settings.workingDays.includes(i)
                }
              />
              {d}
            </label>
          ))}
        </div>
        <label>
          Holiday calendar
          <textarea
            name="holidays"
            rows={3}
            defaultValue={state.settings.holidays.join("\n")}
            placeholder="One date per line, e.g. 2026-10-02"
          />
        </label>
        <div className="info-box">
          <ShieldCheck size={20} />
          <span>
            Device approval, account restrictions, and secure session checks are
            always enabled. Production must be served over HTTPS.
          </span>
        </div>
        <button className="button primary" disabled={busy}>
          Save policies <Check size={16} />
        </button>
      </form>
    </section>
  );
}
