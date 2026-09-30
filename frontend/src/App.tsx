import { useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  Monitor,
  ShieldCheck,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Download,
  Clock,
  Check,
  CheckCheck,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  TriangleAlert,
  SlidersHorizontal,
  CheckCircle2,
  HelpCircle,
  Building2,
} from "lucide-react";
import {
  api,
  duration,
  isWeekend,
  time,
  download,
  type State,
  type Person,
  type Work,
} from "./services/api";
import { Badge, Avatar, Empty, Modal, Stat, SearchBox } from "./components/ui";
import { WeekChart, TeamTable } from "./components/dashboard";
import { Employees, EmployeeForm, EmployeeProfile } from "./pages/Employees";
import { Attendance } from "./pages/Attendance";
import { Tasks, TaskForm, TaskDetail } from "./pages/WorkMonitoring";
import { EmployeeHome } from "./pages/EmployeeWorkspace";
import { Reports } from "./pages/Reports";
import { SettingsForm } from "./pages/Settings";
import { Audit } from "./pages/Security";
import { Login } from "./pages/Login";
type Page =
  | "Overview"
  | "Employees"
  | "Attendance"
  | "Work monitoring"
  | "Reports"
  | "Devices"
  | "Security"
  | "Settings"
  | "Notifications"
  | "My workspace";
const icons: Record<string, any> = {
  Overview: LayoutDashboard,
  Employees: Users,
  Attendance: CalendarDays,
  "Work monitoring": ClipboardList,
  Reports: ChartNoAxesCombined,
  Devices: Monitor,
  Security: ShieldCheck,
  Settings: Settings,
  "My workspace": LayoutDashboard,
};
export default function App() {
  const [state, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState<Page>("Overview"),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<
      "employee" | "task" | "report" | "help" | null
    >(null),
    [selected, setSelected] = useState<Person | null>(null),
    [selectedTask, setSelectedTask] = useState<Work | null>(null),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [loginError, setLoginError] = useState("");
  async function refresh() {
    try {
      const s = await api<State>("/state");
      setState(s);
      setPage((current) =>
        current === "Overview" && s.user.role === "employee"
          ? "My workspace"
          : current,
      );
    } catch (e: any) {
      if (e.status === 401) setState(null);
      else setToast(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function mutate(
    path: string,
    method: string,
    data?: unknown,
    message = "Changes saved",
  ) {
    setBusy(true);
    try {
      await api(path, method, data);
      await refresh();
      setToast(message);
      return true;
    } catch (e: any) {
      setToast(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const go = (p: Page) => {
    setPage(p);
    setSearch("");
    setMobile(false);
    setSelected(null);
  };
  if (loading)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Activity />
        </div>
        <h2>Devicedisk</h2>
        <p>Getting your workspace ready…</p>
      </div>
    );
  if (!state)
    return (
      <>
        <Login
          error={loginError}
          onLogin={async (path, data) => {
            setLoginError("");
            try {
              await api(path, "POST", data);
              const authenticated = await api<State>("/state");
              setState(authenticated);
              setPage(
                authenticated.user.role === "admin"
                  ? "Overview"
                  : "My workspace",
              );
              setSearch("");
              setSelected(null);
              setSelectedTask(null);
            } catch (e: any) {
              setLoginError(e.message);
              throw e;
            }
          }}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  const admin = state.user.role === "admin",
    people = state.employees.filter((e) => e.role === "employee"),
    today = state.attendance.filter(
      (a) => a.date === state.today && !isWeekend(state.today),
    ),
    present = today.length,
    late = today.filter((a) => a.status === "Late").length,
    working = today.filter((a) => !a.logoutTime).length;
  const attention = state.tasks.filter(
      (t) => t.isOverdue || t.status === "Blocked",
    ),
    pending = state.devices.filter((d) => d.status === "Pending"),
    security = state.security.filter((s) => s.status === "Open"),
    unread = state.notifications.filter((n) => n.status === "Open").length;
  const employee = (id: string) => state.employees.find((e) => e.id === id);
  const nav: Page[] = admin
    ? ["Overview", "Employees", "Attendance", "Work monitoring", "Reports"]
    : ["My workspace", "Attendance", "Work monitoring", "Reports"];
  const filteredPeople = people.filter((e) =>
    `${e.name} ${e.department} ${e.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function exportAttendance() {
    download(`attendance-${state!.today}.csv`, [
      [
        "Employee",
        "Date",
        "Login",
        "Logout",
        "Status",
        "Working minutes",
        "Difference minutes",
      ],
      ...today.map((a) => [
        employee(a.employeeId)?.name,
        a.date,
        time(a.loginTime),
        time(a.logoutTime),
        a.status,
        a.effectiveMinutes,
        a.difference,
      ]),
    ]);
    setToast("Attendance report exported");
  }
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-shade" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go(admin ? "Overview" : "My workspace");
          }}
        >
          <span className="brand-mark">
            <Activity size={24} />
          </span>
          DD<span className="brand-period">.</span>
        </a>
        <button className="workspace-switch" onClick={() => setModal("help")}>
          <span className="workspace-logo">
            <Building2 size={18} />
          </span>
          <span>
            <strong>Devicedisk Workspace</strong>
            <small>Devicedisk workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map((p) => {
            const Icon = icons[p];
            return (
              <button
                key={p}
                className={"nav-item " + (page === p ? "active" : "")}
                onClick={() => go(p)}
              >
                <Icon size={19} />
                <span>{p}</span>
                {p === "Work monitoring" && attention.length > 0 && (
                  <span className="nav-count">{attention.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        {admin && (
          <>
            <div className="nav-caption second">ADMINISTRATION</div>
            <nav>
              {(["Devices", "Security", "Settings"] as Page[]).map((p) => {
                const Icon = icons[p];
                return (
                  <button
                    key={p}
                    className={"nav-item " + (page === p ? "active" : "")}
                    onClick={() => go(p)}
                  >
                    <Icon size={19} />
                    <span>{p}</span>
                    {p === "Security" && security.length > 0 && (
                      <span className="nav-count alert">{security.length}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="secure-card">
            <span className="secure-icon">
              <ShieldCheck size={19} />
            </span>
            <strong>A safer place to work</strong>
            <p>
              Connected through verified
              <br />
              company devices.
            </p>
            <button onClick={() => go(admin ? "Devices" : "My workspace")}>
              View workspace security <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="help-link" onClick={() => setModal("help")}>
            <HelpCircle size={18} /> Help & getting started{" "}
            <ArrowUpRight size={15} />
          </button>
          <button
            className="profile"
            onClick={async () => {
              if (await mutate("/auth/logout", "POST", {}, "Signed out"))
                setState(null);
            }}
          >
            <Avatar person={state.user} />
            <span>
              <strong>{state.user.name}</strong>
              <small>{admin ? "Workspace admin" : "Employee"}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="live-dot" />{" "}
            <span className="system-status">All systems operational</span>
            <span className="top-divider" />
            <button
              className="notification-button icon-button"
              aria-label="Notifications"
              onClick={() => go("Notifications")}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <Avatar person={state.user} small />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {admin ? "YOUR TEAM, IN SYNC" : "MAKE TODAY COUNT"}{" "}
                <span>✦</span>
              </div>
              <h1>
                {page === "Overview"
                  ? `A good day starts with a clear view.`
                  : page === "My workspace"
                    ? `Hello, ${state.user.name.split(" ")[0]}.`
                    : page}
              </h1>
              <p>
                {
                  {
                    Overview:
                      "A little clarity on your people, their progress, and the day ahead.",
                    Employees: "The people who make it all happen.",
                    Attendance:
                      "Every check-in, working hour, and day accounted for.",
                    "Work monitoring":
                      "A shared view of priorities, progress, and the support your team needs.",
                    Reports: "Turn everyday progress into a bigger picture.",
                    Devices:
                      "Trusted workstations. Secure access. Peace of mind.",
                    Security:
                      "Keep an eye on access and protect your workspace.",
                    Settings:
                      "Make Devicedisk crm work the way your company does.",
                    Notifications: "The latest updates across your workspace.",
                    "My workspace":
                      "Your time, your priorities, and everything you need for a productive day.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {state.demo && <span className="demo-label">DEMO WORKSPACE</span>}
              <button
                className="button date-button"
                onClick={() => go("Attendance")}
              >
                <CalendarDays size={16} />
                {new Date(state.today + "T12:00:00").toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "short", year: "numeric" },
                )}
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
          {page === "Overview" && (
            <>
              <div className="overview-strip">
                <span>
                  <span className="live-dot" /> Live overview{" "}
                  <span className="muted">
                    · Updated {time(state.serverTime)}
                  </span>
                </span>
                <button className="text-button" onClick={exportAttendance}>
                  <Download size={15} /> Export report
                </button>
              </div>
              <div className="stats-grid">
                <Stat
                  title="Total employees"
                  value={people.filter((e) => e.status === "Active").length}
                  icon={<Users size={19} />}
                  detail={
                    <>
                      <span className="green">Your whole team</span>
                      <span>
                        across {new Set(people.map((e) => e.department)).size}{" "}
                        departments
                      </span>
                    </>
                  }
                />
                <Stat
                  title="Present today"
                  value={present}
                  total={people.length}
                  icon={<CheckCircle2 size={19} />}
                  detail={
                    <>
                      <span className="green">
                        {isWeekend(state.today) ? 'No attendance required' : `${people.length ? Math.round((present / people.length) * 100) : 0}% attendance`}
                      </span>
                      <span>
                        {isWeekend(state.today)
                          ? "Weekly off today"
                          : `${Math.max(0, people.length - present)} absent today`}
                      </span>
                    </>
                  }
                />
                <Stat
                  title="Currently working"
                  value={working}
                  icon={<Clock size={19} />}
                  detail={
                    <>
                      <span className="green">
                        <span className="live-dot" /> Live right now
                      </span>
                      <span>
                        {today.filter((a) => a.effectiveMinutes >= 540).length}{" "}
                        reached daily target
                      </span>
                    </>
                  }
                />
                <Stat
                  title="Late arrivals"
                  value={late}
                  icon={<Clock size={19} />}
                  warm
                  detail={
                    <>
                      <span className="amber">
                        After {state.settings.lateThreshold}
                      </span>
                      <span>Grace period included</span>
                    </>
                  }
                />
              </div>
              <div className="dashboard-middle">
                <section className="panel attendance-chart">
                  <div className="panel-heading">
                    <div>
                      <h2>Attendance at a glance</h2>
                      <p>A healthy rhythm for a productive team.</p>
                    </div>
                    <button
                      className="button small-button"
                      onClick={() => go("Reports")}
                    >
                      This week <ChevronDown size={13} />
                    </button>
                  </div>
                  <WeekChart state={state} />
                </section>
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <div className="title-with-count">
                      <span className="attention-icon">
                        <TriangleAlert size={17} />
                      </span>
                      <h2>Attention required</h2>
                      <span className="pill-count">
                        {attention.length + pending.length}
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      title="View work monitoring"
                      onClick={() => go("Work monitoring")}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                  <p className="attention-intro">
                    A few things could use a closer look.
                  </p>
                  <div className="attention-items">
                    {attention.slice(0, 2).map((t) => (
                      <button
                        className="attention-item"
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                      >
                        <span
                          className={
                            "attention-item-icon " +
                            (t.status === "Blocked" ? "red" : "")
                          }
                        >
                          <Clock size={16} />
                        </span>
                        <span>
                          <strong>
                            {t.status === "Blocked"
                              ? "A task needs your support"
                              : "Task estimate exceeded"}
                          </strong>
                          <p>
                            {employee(t.employeeId)?.name}{" "}
                            <span>· {t.title}</span>
                          </p>
                          <small>
                            {t.status === "Blocked"
                              ? "Blocked · Waiting for review"
                              : `${duration(t.elapsedMinutes)} actual / ${duration(t.estimatedMinutes)} estimated`}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    {pending.slice(0, 1).map((d) => (
                      <button
                        className="attention-item"
                        key={d.id}
                        onClick={() => go("Devices")}
                      >
                        <span className="attention-item-icon blue">
                          <Monitor size={16} />
                        </span>
                        <span>
                          <strong>New device access request</strong>
                          <p>
                            {employee(d.employeeId)?.name}{" "}
                            <span>· {d.name}</span>
                          </p>
                          <small>Awaiting your approval</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    {!attention.length && !pending.length && (
                      <Empty
                        title="All caught up"
                        detail="Nothing needs your attention right now."
                      />
                    )}
                  </div>
                  <button
                    className="panel-footer-link"
                    onClick={() => go("Work monitoring")}
                  >
                    Review team progress <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <section className="panel team-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Your team today{" "}
                      <span className="subtle-count">
                        {people.length} employees
                      </span>
                    </h2>
                    <p>A real-time pulse on attendance and work.</p>
                  </div>
                  <button className="button" onClick={() => go("Employees")}>
                    View all employees <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="table-toolbar">
                  <div className="table-tabs">
                    <button className="selected" onClick={() => setSearch("")}>
                      All employees <span>{people.length}</span>
                    </button>
                    <button onClick={() => go("Attendance")}>Attendance</button>
                    <button onClick={() => go("Work monitoring")}>
                      Work progress
                    </button>
                  </div>
                  <div className="table-controls">
                    <SearchBox
                      value={search}
                      onChange={setSearch}
                      placeholder="Search employees…"
                    />
                    <button
                      className="button filter-button"
                      onClick={() => go("Employees")}
                    >
                      <SlidersHorizontal size={15} /> Filters
                    </button>
                  </div>
                </div>
                <TeamTable
                  people={filteredPeople.slice(0, 6)}
                  state={state}
                  onSelect={setSelected}
                />
                <div className="table-bottom">
                  <span>
                    Showing {Math.min(6, filteredPeople.length)} of{" "}
                    {filteredPeople.length} employees
                  </span>
                  <button
                    className="text-button"
                    onClick={() => go("Employees")}
                  >
                    View the whole team <ArrowRight size={14} />
                  </button>
                </div>
              </section>
              <div className="bottom-note">
                <ShieldCheck size={14} /> Your workspace is protected. Only
                approved devices can access employee accounts.
                <span>Work well. Together.</span>
              </div>
            </>
          )}
          {page === "Employees" && (
            <Employees
              people={filteredPeople}
              state={state}
              search={search}
              setSearch={setSearch}
              onAdd={() => setModal("employee")}
              onSelect={setSelected}
            />
          )}
          {page === "Attendance" && (
            <Attendance
              state={state}
              search={search}
              setSearch={setSearch}
              onSelect={setSelected}
            />
          )}
          {page === "Work monitoring" && (
            <Tasks
              state={state}
              search={search}
              setSearch={setSearch}
              onAdd={() => setModal("task")}
              onSelect={setSelectedTask}
            />
          )}
          {page === "My workspace" && (
            <>
              <EmployeeHome
                state={state}
                busy={busy}
                mutate={mutate}
                onTask={() => setModal("task")}
                onReport={() => setModal("report")}
              />
              <Tasks
                state={state}
                search={search}
                setSearch={setSearch}
                onAdd={() => setModal("task")}
                onSelect={setSelectedTask}
              />
            </>
          )}
          {page === "Devices" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Company devices{" "}
                    <span className="subtle-count">
                      {state.devices.length} registered
                    </span>
                  </h2>
                  <p>
                    Approve requests only after verifying the physical company
                    asset.
                  </p>
                </div>
                <Badge tone="green">Device verification active</Badge>
              </div>
              <div className="device-grid">
                {state.devices.map((d) => (
                  <article className="device-card" key={d.id}>
                    <div className="device-card-top">
                      <span className="device-art">
                        <Monitor size={28} />
                      </span>
                      <Badge
                        tone={
                          d.status === "Approved"
                            ? "green"
                            : d.status === "Pending"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {d.status}
                      </Badge>
                    </div>
                    <h3>{d.name}</h3>
                    <p>
                      {d.os} ·{" "}
                      {d.browser.length > 25 ? "Web browser" : d.browser}
                    </p>
                    <div className="device-owner">
                      {employee(d.employeeId) && (
                        <Avatar person={employee(d.employeeId)!} small />
                      )}
                      <span>
                        {employee(d.employeeId)?.name || "Former employee"}
                      </span>
                    </div>
                    <div className="device-meta">
                      Registered{" "}
                      {new Date(d.createdAt).toLocaleDateString("en-GB")}
                      <br />
                      Last used:{" "}
                      {d.lastUsed
                        ? new Date(d.lastUsed).toLocaleDateString("en-GB")
                        : "Not yet used"}
                    </div>
                    {d.status === "Pending" ? (
                      <div className="button-row">
                        <button
                          disabled={busy}
                          className="button primary"
                          onClick={() =>
                            mutate(
                              `/devices/${d.id}`,
                              "PATCH",
                              { status: "Approved" },
                              "Company device approved",
                            )
                          }
                        >
                          <Check size={15} />
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() =>
                            mutate(
                              `/devices/${d.id}`,
                              "PATCH",
                              { status: "Rejected" },
                              "Device request rejected",
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      d.status === "Approved" && (
                        <button
                          disabled={busy}
                          className="text-button danger"
                          onClick={() =>
                            mutate(
                              `/devices/${d.id}`,
                              "PATCH",
                              { status: "Revoked" },
                              "Device access revoked",
                            )
                          }
                        >
                          Revoke access
                        </button>
                      )
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
          {page === "Security" && (
            <>
              <div className="stats-grid three">
                <Stat
                  title="Open security events"
                  value={security.length}
                  icon={<ShieldCheck size={19} />}
                  detail="All unauthorized attempts are blocked"
                />
                <Stat
                  title="Approved devices"
                  value={
                    state.devices.filter((d) => d.status === "Approved").length
                  }
                  icon={<Monitor size={19} />}
                  detail="Verified company workstations"
                />
                <Stat
                  title="Pending requests"
                  value={pending.length}
                  icon={<Clock size={19} />}
                  detail="Require administrator approval"
                />
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Security events</h2>
                  <Badge tone="green">Access controls enabled</Badge>
                </div>
                {state.security.length ? (
                  state.security.map((e) => (
                    <div className="event-row" key={e.id}>
                      <span className="event-icon">
                        <ShieldCheck size={21} />
                      </span>
                      <div>
                        <h3>
                          {e.title}{" "}
                          <Badge tone={e.status === "Open" ? "red" : "green"}>
                            {e.status}
                          </Badge>
                        </h3>
                        <p>{e.description}</p>
                        <small>
                          {employee(e.employeeId)?.name || "Unknown account"} ·{" "}
                          {new Date(e.createdAt).toLocaleString("en-IN")} ·{" "}
                          {e.ip} · {e.device}
                        </small>
                      </div>
                      {e.status === "Open" && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            mutate(
                              `/security/${e.id}`,
                              "PATCH",
                              {},
                              "Security event marked as reviewed",
                            )
                          }
                        >
                          Mark reviewed
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No security events"
                    detail="Suspicious access attempts will appear here."
                  />
                )}
              </section>
              <Audit state={state} />
            </>
          )}
          {page === "Reports" && <Reports state={state} notify={setToast} />}
          {page === "Settings" && (
            <SettingsForm state={state} busy={busy} mutate={mutate} />
          )}
          {page === "Notifications" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  Workspace updates{" "}
                  <span className="subtle-count">{unread} unread</span>
                </h2>
              </div>
              {state.notifications.length ? (
                state.notifications.map((n) => (
                  <div
                    className={
                      "event-row " + (n.status === "Read" ? "read" : "")
                    }
                    key={n.id}
                  >
                    <span className="event-icon">
                      <Bell size={20} />
                    </span>
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.description}</p>
                      <small>
                        {employee(n.employeeId)?.name} ·{" "}
                        {new Date(n.createdAt).toLocaleString("en-IN")}
                      </small>
                    </div>
                    {n.status === "Open" && (
                      <button
                        className="icon-button"
                        title="Mark as read"
                        onClick={() =>
                          mutate(
                            `/notifications/${n.id}`,
                            "PATCH",
                            {},
                            "Notification read",
                          )
                        }
                      >
                        <CheckCheck size={20} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <Empty
                  title="You're all caught up"
                  detail="New attendance, work, and security updates will appear here."
                />
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>© {new Date().getFullYear()} Workpulse</span>
            <span>
              Made for a more connected workday <span className="green">✦</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "employee" && (
        <Modal title="Add a team member" onClose={() => setModal(null)}>
          <EmployeeForm
            busy={busy}
            onSubmit={async (data) => {
              if (
                await mutate(
                  "/employees",
                  "POST",
                  data,
                  "Employee added. They can now request device access.",
                )
              )
                setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "task" && (
        <Modal
          title={admin ? "Assign a new task" : "Plan today’s work"}
          onClose={() => setModal(null)}
        >
          <TaskForm
            state={state}
            busy={busy}
            onSubmit={async (data) => {
              if (await mutate("/tasks", "POST", data, "Task created"))
                setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "report" && (
        <Modal title="Your daily work report" onClose={() => setModal(null)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await mutate(
                  "/reports/daily",
                  "POST",
                  Object.fromEntries(f),
                  "Daily report submitted",
                )
              )
                setModal(null);
            }}
          >
            <label>
              What did you accomplish today?
              <textarea
                name="summary"
                required
                minLength={10}
                rows={5}
                placeholder="Share completed work, progress, and key outcomes…"
              />
            </label>
            <label>
              Blockers or support needed
              <textarea
                name="blockers"
                rows={3}
                placeholder="Anything the team can help with?"
              />
            </label>
            <button className="button primary" disabled={busy}>
              Submit daily report <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Welcome to Workpulse" onClose={() => setModal(null)}>
          <div className="help-content">
            <p>
              Your team's attendance, work, and device security in one place.
            </p>
            <h3>Getting your team started</h3>
            <ol>
              <li>Add employees from the Employees page.</li>
              <li>
                Ask each employee to sign in on their company laptop and request
                device access.
              </li>
              <li>Verify the asset, then approve the request in Devices.</li>
              <li>
                Employees sign in again to start attendance and plan their work.
              </li>
            </ol>
            <p>
              Company timezone: <strong>Asia/Kolkata</strong>. Sessions close at{" "}
              {state.settings.endTime}; hours are calculated from actual
              sessions and recorded breaks.
            </p>
            {state.demo && (
              <div className="info-box">
                This is a local demo with fictional records. Production setup
                instructions are in README.md.
              </div>
            )}
          </div>
        </Modal>
      )}
      {selected && (
        <Modal title="Employee profile" wide onClose={() => setSelected(null)}>
          <EmployeeProfile
            person={
              state.employees.find((e) => e.id === selected.id) || selected
            }
            state={state}
            busy={busy}
            mutate={mutate}
            onDelete={() => setSelected(null)}
          />
        </Modal>
      )}
      {selectedTask && (
        <Modal title="Task details" onClose={() => setSelectedTask(null)}>
          <TaskDetail
            task={
              state.tasks.find((t) => t.id === selectedTask.id) || selectedTask
            }
            person={employee(selectedTask.employeeId)}
            admin={admin}
            busy={busy}
            onSave={async (patch) => {
              if (
                await mutate(
                  `/tasks/${selectedTask.id}`,
                  "PATCH",
                  patch,
                  "Task updated",
                )
              )
                setSelectedTask(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
