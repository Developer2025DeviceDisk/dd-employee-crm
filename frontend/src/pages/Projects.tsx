import { useRef, useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { duration, isWeekend, type State, type Work } from "../services/api";
import { Badge, Empty, Modal } from "../components/ui";
import { TaskForm, Tasks } from "./WorkMonitoring";
import "../styles/projects.css";

type Mutate = (
  path: string,
  method: string,
  data: any,
  message: string,
) => Promise<boolean>;

export function WorkLogs({
  state,
  taskId,
  projectId,
}: {
  state: State;
  taskId?: string;
  projectId?: string;
}) {
  const logs = state.workLogs.filter(
    (l) =>
      (!taskId || l.taskId === taskId) &&
      (!projectId || l.projectId === projectId),
  );
  return (
    <section className="panel work-log-panel">
      <div className="panel-heading">
        <div>
          <h2>Work logs</h2>
          <p>Dated entries, newest first. Time is entered manually.</p>
        </div>
      </div>
      <div className="project-table-scroll">
        <table className="work-log-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Project / task</th>
              <th>Work details</th>
              <th>Time spent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.date}</td>
                <td>
                  {state.employees.find((e) => e.id === l.employeeId)?.name ||
                    "Former employee"}
                </td>
                <td>
                  {state.projects.find((p) => p.id === l.projectId)?.name}
                  <br />
                  <small>
                    {state.tasks.find((t) => t.id === l.taskId)?.title}
                  </small>
                </td>
                <td>
                  {l.details}
                  {l.source === "legacy" && (
                    <small className="log-note">
                      Imported total, attributed to the original task date
                    </small>
                  )}
                  {l.recordedBy !== l.employeeId && (
                    <small className="log-note">Recorded by admin</small>
                  )}
                </td>
                <td>{duration(l.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!logs.length && (
        <Empty
          title="No work logged yet"
          detail="Open a task and record the date and time spent."
        />
      )}
    </section>
  );
}

export function LogWorkForm({
  task,
  state,
  busy,
  mutate,
}: {
  task: Work;
  state: State;
  busy: boolean;
  mutate: Mutate;
}) {
  const request = useRef({ body: "", id: "" });
  return (
    <form
      className="form work-log-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = Object.fromEntries(new FormData(form));
        const input = {
          date: f.date,
          minutes: Number(f.minutes),
          details: f.details,
        };
        const body = JSON.stringify(input);
        if (request.current.body !== body)
          request.current = { body, id: crypto.randomUUID() };
        if (
          await mutate(
            `/tasks/${task.id}/logs`,
            "POST",
            { ...input, id: request.current.id },
            "Work log saved",
          )
        ) {
          form.reset();
          request.current = { body: "", id: "" };
        }
      }}
    >
      <h3>Log work</h3>
      <p className="muted">
        Enter time spent on this task. It contributes to the employee's daily
        total across all projects.
      </p>
      <div className="form-row">
        <label>
          Work date
          <input
            type="date"
            name="date"
            required
            defaultValue={state.today}
            max={state.today}
            min={
              state.employees.find((e) => e.id === task.employeeId)?.joiningDate
            }
          />
        </label>
        <label>
          Time spent (minutes)
          <input
            type="number"
            name="minutes"
            required
            min={1}
            max={1440}
            step={1}
            placeholder="e.g. 90 for 1h 30m"
          />
        </label>
      </div>
      <label>
        Work completed
        <textarea
          name="details"
          required
          maxLength={3000}
          rows={3}
          placeholder="Describe what you worked on during this time"
        />
      </label>
      <button className="button primary" disabled={busy}>
        Save work log
      </button>
    </form>
  );
}

export function DailyWorkSummary({ state }: { state: State }) {
  const [chosenDate, setDate] = useState("");
  const date = chosenDate || state.today;
  const off =
    isWeekend(date) ||
    state.settings.holidays.includes(date) ||
    !state.settings.workingDays.includes(
      new Date(`${date}T12:00:00+05:30`).getUTCDay(),
    );
  const people = state.employees.filter(
    (e) => e.role === "employee" && e.joiningDate <= date,
  );
  return (
    <section className="panel work-log-panel">
      <div className="panel-heading">
        <div>
          <h2>Daily work progress</h2>
          <p>
            8 hours across all projects on working days. Weekly offs and
            holidays have no target.
          </p>
        </div>
        <label className="work-date">
          Work date
          <input
            aria-label="Daily work date"
            type="date"
            value={date}
            max={state.today}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div className="project-table-scroll">
        <table className="work-log-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Logged work</th>
              <th>Daily target</th>
              <th>Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {people.map((e) => {
              const total = state.workLogs
                .filter((l) => l.employeeId === e.id && l.date === date)
                .reduce((sum, l) => sum + l.minutes, 0);
              return (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{duration(total)}</td>
                  <td>{off ? "No target" : "8h"}</td>
                  <td>{duration(off ? 0 : Math.max(0, 480 - total))}</td>
                  <td>
                    <Badge
                      tone={off ? "blue" : total >= 480 ? "green" : "amber"}
                    >
                      {off
                        ? "Day off"
                        : total >= 480
                          ? "8 hours completed"
                          : "Incomplete"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!people.length && <p className="muted">No employees for this date.</p>}
    </section>
  );
}

export function Projects({
  state,
  busy,
  mutate,
  onSelect,
}: {
  state: State;
  busy: boolean;
  mutate: Mutate;
  onSelect: (task: Work) => void;
}) {
  const [selected, select] = useState("");
  const [modal, setModal] = useState<"project" | "task" | null>(null);
  const [search, setSearch] = useState("");
  const project = state.projects.find((p) => p.id === selected);
  return (
    <div className="projects-workspace">
      <DailyWorkSummary state={state} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{project ? project.name : "Projects"}</h2>
            <p>
              {project
                ? project.description
                : "Organize tasks and modules across all your projects."}
            </p>
          </div>
          <div className="button-row">
            {project && (
              <button className="button" onClick={() => select("")}>
                <ArrowLeft size={16} />
                All projects
              </button>
            )}
            <button
              className="button primary"
              disabled={busy}
              onClick={() => setModal("project")}
            >
              <Plus size={16} />
              Create project
            </button>
          </div>
        </div>
        {project ? (
          <div className="project-summary">
            <div>
              <small>Total logged time</small>
              <strong>{duration(project.totalMinutes)}</strong>
            </div>
            <div>
              <small>Total tasks</small>
              <strong>{project.taskCount}</strong>
            </div>
            <div>
              <small>Completed</small>
              <strong>{project.completedCount}</strong>
            </div>
            <div>
              <small>In progress</small>
              <strong>{project.inProgressCount}</strong>
            </div>
            <div>
              <small>Pending</small>
              <strong>{project.pendingCount}</strong>
            </div>
          </div>
        ) : (
          <div className="project-grid">
            {state.projects.map((p) => (
              <button
                className="project-card"
                key={p.id}
                onClick={() => {
                  select(p.id);
                  setSearch("");
                }}
              >
                <h3>{p.name}</h3>
                <p>{p.description || "No description"}</p>
                <span>
                  {state.employees.find((e) => e.id === p.employeeId)?.name ||
                    "Former employee"}
                </span>
                <div>
                  <strong>{duration(p.totalMinutes)}</strong>
                  <span>
                    {p.completedCount} / {p.taskCount} tasks completed
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        {!state.projects.length && (
          <Empty
            title="Create your first project"
            detail="Add tasks, record work, and track your daily progress across projects."
          />
        )}
      </section>
      {project && (
        <Tasks
          state={{
            ...state,
            tasks: state.tasks.filter((t) => t.projectId === project.id),
          }}
          search={search}
          setSearch={setSearch}
          onAdd={() => setModal("task")}
          onSelect={onSelect}
        />
      )}
      <WorkLogs state={state} projectId={project?.id} />
      {modal === "project" && (
        <Modal title="Create project" onClose={() => setModal(null)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "/projects",
                  "POST",
                  Object.fromEntries(new FormData(e.currentTarget)),
                  "Project created",
                )
              )
                setModal(null);
            }}
          >
            <label>
              Project name
              <input
                autoFocus
                name="name"
                required
                minLength={3}
                maxLength={150}
              />
            </label>
            <label>
              Description
              <textarea name="description" rows={3} maxLength={3000} />
            </label>
            {state.user.role === "admin" && (
              <label>
                Employee
                <select name="employeeId" required>
                  <option value="">Select employee</option>
                  {state.employees
                    .filter(
                      (e) => e.role === "employee" && e.status === "Active",
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button className="button primary" disabled={busy}>
              Create project
            </button>
          </form>
        </Modal>
      )}
      {modal === "task" && project && (
        <Modal
          title={`Add task to ${project.name}`}
          onClose={() => setModal(null)}
        >
          <TaskForm
            state={{ ...state, projects: [project] }}
            projectId={project.id}
            busy={busy}
            onSubmit={async (data) => {
              if (await mutate("/tasks", "POST", data, "Task created"))
                setModal(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
