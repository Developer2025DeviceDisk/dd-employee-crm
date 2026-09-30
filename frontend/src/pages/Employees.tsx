import { useState } from "react";
import {
  Activity,
  Monitor,
  Search,
  Plus,
  Mail,
  Briefcase,
  Calendar,
} from "lucide-react";
import {
  duration,
  time,
  type Person,
  type Work,
  type Entry,
} from "../services/api";
import { Badge, Avatar, SearchBox } from "../components/ui";
import { TeamTable } from "../components/dashboard";
import { Attendance } from "./Attendance";
export function Employees({
  people,
  state,
  search,
  setSearch,
  onAdd,
  onSelect,
}: any) {
  const [department, setDepartment] = useState("All departments");
  const filtered = people.filter(
    (p: Person) =>
      department === "All departments" || p.department === department,
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            Team directory{" "}
            <span className="subtle-count">{people.length} members</span>
          </h2>
          <p>Your people and their day, all in one place.</p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={16} />
          Add employee
        </button>
      </div>
      <div className="table-toolbar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, or department…"
        />
        <select
          aria-label="Filter department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option>All departments</option>
          {Array.from(
            new Set<string>(state.employees.map((p: Person) => p.department)),
          ).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <TeamTable people={filtered} state={state} onSelect={onSelect} />
    </section>
  );
}

export function EmployeeForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (data: any) => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <div className="info-box">
        New employees must request access from their company device before
        signing in.
      </div>
      <label>
        Full name
        <input
          autoFocus
          name="name"
          required
          minLength={2}
          placeholder="e.g. Rahul Sharma"
        />
      </label>
      <label>
        Work email
        <input
          name="email"
          type="email"
          required
          placeholder="rahul@company.com"
        />
      </label>
      <div className="form-row">
        <label>
          Department
          <select name="department">
            {[
              "Engineering",
              "Design",
              "Marketing",
              "Operations",
              "People",
              "Sales",
              "Finance",
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Designation
          <input
            name="designation"
            required
            minLength={2}
            placeholder="e.g. Developer"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Joining date
          <input
            name="joiningDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" placeholder="Optional" />
        </label>
      </div>
      <label>
        Initial password
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          placeholder="At least 12 characters"
        />
      </label>
      <button className="button primary" disabled={busy}>
        Create employee <Plus size={16} />
      </button>
    </form>
  );
}

export function EmployeeProfile({
  person,
  state,
  busy,
  mutate,
  onDelete,
}: any) {
  const [edit, setEdit] = useState(false),
    [confirm, setConfirm] = useState(false);
  const a = state.attendance.find(
    (a: Entry) => a.employeeId === person.id && a.date === state.today,
  );
  const audit = state.audit
    .filter((e: any) => e.employeeId === person.id)
    .slice(0, 12);
  return (
    <div className="profile-detail">
      <div className="profile-hero">
        <Avatar person={person} />
        <div>
          <h2>{person.name}</h2>
          <p>
            {person.designation} · {person.department}
          </p>
        </div>
        <Badge tone={person.status === "Active" ? "green" : "neutral"}>
          {person.status}
        </Badge>
      </div>
      <div className="profile-facts">
        <span>
          <Mail size={16} />
          {person.email}
        </span>
        <span>
          <Briefcase size={16} />
          {person.employeeId}
        </span>
        <span>
          <Calendar size={16} />
          Joined {person.joiningDate}
        </span>
        <span>
          <Monitor size={16} />
          {
            state.devices.filter(
              (d: any) => d.employeeId === person.id && d.status === "Approved",
            ).length
          }{" "}
          approved devices
        </span>
      </div>
      <div className="detail-metrics">
        <div>
          <small>Today's login</small>
          <strong>{time(a?.loginTime)}</strong>
        </div>
        <div>
          <small>Effective hours</small>
          <strong>{a ? duration(a.effectiveMinutes) : "—"}</strong>
        </div>
        <div>
          <small>Daily difference</small>
          <strong>
            {a
              ? `${a.difference < 0 ? "−" : "+"}${duration(Math.abs(a.difference))}`
              : "—"}
          </strong>
        </div>
      </div>
      {state.user.role === "admin" && (
        <>
          <div className="button-row">
            <button className="button" onClick={() => setEdit(!edit)}>
              Edit profile
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                mutate(
                  `/employees/${person.id}`,
                  "PATCH",
                  {
                    status: person.status === "Active" ? "Inactive" : "Active",
                  },
                  "Employee account updated",
                )
              }
            >
              {person.status === "Active" ? "Deactivate" : "Activate"} account
            </button>
            <button
              className="text-button danger"
              onClick={() => setConfirm(true)}
            >
              Delete employee
            </button>
          </div>
          {confirm && (
            <div className="info-box amber-box">
              <p>
                Delete {person.name}'s account and revoke their devices?
                Attendance history is retained for audit.
              </p>
              <div className="button-row">
                <button className="button" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await mutate(
                        `/employees/${person.id}`,
                        "DELETE",
                        {},
                        "Employee removed",
                      )
                    )
                      onDelete();
                  }}
                >
                  Confirm deletion
                </button>
              </div>
            </div>
          )}
          {edit && (
            <form
              className="form inset-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate(
                    `/employees/${person.id}`,
                    "PATCH",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  )
                )
                  setEdit(false);
              }}
            >
              {["name", "department", "designation", "phone"].map((k) => (
                <label key={k}>
                  {k}
                  <input
                    name={k}
                    defaultValue={person[k]}
                    required={k !== "phone"}
                  />
                </label>
              ))}
              <button className="button primary" disabled={busy}>
                Save profile
              </button>
            </form>
          )}
        </>
      )}
      <h3 className="section-title">Recent activity</h3>
      <div className="timeline">
        {audit.length ? (
          audit.map((e: any) => (
            <div className="timeline-row" key={e.id}>
              <i />
              <span>
                <strong>{e.type}</strong>
                <p>{e.description}</p>
              </span>
              <small>{time(e.createdAt)}</small>
            </div>
          ))
        ) : (
          <p className="muted">
            Activity will appear as this employee uses the workspace.
          </p>
        )}
      </div>
    </div>
  );
}
