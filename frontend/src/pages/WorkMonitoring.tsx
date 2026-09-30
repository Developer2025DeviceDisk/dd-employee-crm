import { useState } from "react";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Clock,
  Check,
  MoreHorizontal,
} from "lucide-react";
import {
  duration,
  time,
  type State,
  type Person,
  type Work,
} from "../services/api";
import { Badge, Avatar, Empty, SearchBox } from "../components/ui";
export function Tasks({
  state,
  search,
  setSearch,
  onAdd,
  onSelect,
}: {
  state: State;
  search: string;
  setSearch: (s: string) => void;
  onAdd: () => void;
  onSelect: (t: Work) => void;
}) {
  const [filter, setFilter] = useState("All tasks");
  const tasks = state.tasks.filter(
    (t) =>
      `${t.title} ${state.employees.find((e) => e.id === t.employeeId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All tasks" ||
        (filter === "Needs review" &&
          (t.isOverdue || t.status === "Blocked")) ||
        t.status === filter),
  );
  return (
    <section className="panel tasks-section">
      <div className="panel-heading">
        <div>
          <h2>Project tasks</h2>
          <p>
            Record completed work in dated logs. Task status does not start a
            timer.
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={16} />
          {state.user.role === "admin" ? "Assign task" : "Add task"}
        </button>
      </div>
      <div className="table-toolbar">
        <div className="table-tabs">
          {[
            "All tasks",
            "Pending",
            "In Progress",
            "Completed",
            "Needs review",
          ].map((f) => (
            <button
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
              key={f}
            >
              {f}
            </button>
          ))}
        </div>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search tasks…"
        />
      </div>
      <div className="task-grid">
        {tasks.map((t) => {
          const p = state.employees.find((e) => e.id === t.employeeId);
          return (
            <button
              className="task-card"
              key={t.id}
              onClick={() => onSelect(t)}
            >
              <div className="task-card-top">
                <span className={"priority " + t.priority.toLowerCase()}>
                  <span /> {t.priority} priority
                </span>
                <MoreHorizontal size={18} />
              </div>
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              <Badge
                tone={
                  t.status === "Completed"
                    ? "green"
                    : t.status === "Blocked"
                      ? "red"
                      : t.isOverdue
                        ? "amber"
                        : "blue"
                }
              >
                {t.status}
              </Badge>
              {t.isOverdue && (
                <span className="muted"> Logged time exceeds estimate</span>
              )}
              <div className="task-times">
                <span>
                  <Clock size={14} />
                  {duration(t.elapsedMinutes)}{" "}
                  <small>/ {duration(t.estimatedMinutes)}</small>
                </span>
                <span>
                  {Math.round((t.elapsedMinutes / t.estimatedMinutes) * 100)}%
                </span>
              </div>
              <div
                className={"progress-track " + (t.isOverdue ? "overrun" : "")}
              >
                <i
                  style={{
                    width: `${Math.min(100, (t.elapsedMinutes / t.estimatedMinutes) * 100)}%`,
                  }}
                />
              </div>
              <div className="task-card-bottom">
                {p && (
                  <>
                    <Avatar person={p} small />
                    <span>{p.name}</span>
                  </>
                )}
                <ArrowUpRight size={16} />
              </div>
            </button>
          );
        })}
      </div>
      {!tasks.length && (
        <Empty
          title="A little room for your next idea"
          detail="Add a task or adjust your filters to get started."
        />
      )}
    </section>
  );
}

export function TaskForm({
  state,
  busy,
  onSubmit,
  projectId,
}: {
  state: State;
  busy: boolean;
  onSubmit: (data: any) => void;
  projectId?: string;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        onSubmit({ ...f, estimatedMinutes: Math.round(Number(f.hours) * 60) });
      }}
    >
      <label>
        Project
        <select name="projectId" required defaultValue={projectId || ""}>
          <option value="" disabled>
            Select a project
          </option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {state.user.role === "admin"
                ? ` — ${state.employees.find((e) => e.id === p.employeeId)?.name || "Former employee"}`
                : ""}
            </option>
          ))}
        </select>
      </label>
      {!state.projects.length && (
        <p className="info-box">
          Create a project in your workspace before adding a task.
        </p>
      )}
      <label>
        What are you working on?
        <input
          autoFocus
          name="title"
          required
          minLength={3}
          placeholder="e.g. CRM dashboard development"
        />
      </label>
      <div className="form-row">
        <label>
          Estimated hours
          <input
            name="hours"
            required
            type="number"
            min={0.25}
            max={168}
            step={0.25}
            defaultValue={2}
          />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="Medium">
            {["Low", "Medium", "High", "Critical"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea
          name="description"
          required
          maxLength={3000}
          rows={4}
          placeholder="Add context, expected outcomes, or helpful links…"
        />
      </label>
      <button
        className="button primary"
        disabled={busy || !state.projects.length}
      >
        Create task <ArrowRight size={16} />
      </button>
    </form>
  );
}

export function TaskDetail({
  task,
  person,
  admin,
  busy,
  onSave,
}: {
  task: Work;
  person?: Person;
  admin: boolean;
  busy: boolean;
  onSave: (d: any) => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <div>
        <span className="eyebrow">
          {person?.name} · {task.date}
        </span>
        <h2>{task.title}</h2>
        <p className="muted">{task.description}</p>
      </div>
      <div className="detail-metrics">
        <div>
          <small>Estimated</small>
          <strong>{duration(task.estimatedMinutes)}</strong>
        </div>
        <div>
          <small>Logged time</small>
          <strong>{duration(task.elapsedMinutes)}</strong>
        </div>
        <div>
          <small>Priority</small>
          <strong>{task.priority}</strong>
        </div>
      </div>
      {task.isOverdue && (
        <div className="info-box amber-box">
          This task has exceeded its estimate. Review the context and any
          blockers with the employee.
        </div>
      )}
      <label>
        Task status
        <select name="status" defaultValue={task.status}>
          {["Pending", "In Progress", "Completed", "Blocked"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Employee comments
        <textarea name="comment" defaultValue={task.comment} rows={3} />
      </label>
      {admin ? (
        <label>
          Admin comments
          <textarea
            name="adminComment"
            defaultValue={task.adminComment}
            rows={3}
          />
        </label>
      ) : (
        task.adminComment && (
          <div className="info-box">Admin: {task.adminComment}</div>
        )
      )}
      <button className="button primary" disabled={busy}>
        Save changes <Check size={16} />
      </button>
    </form>
  );
}
