import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  ArrowLeft,
  LockKeyhole,
} from "lucide-react";
import { api, type Work } from "../services/api";
import { Attendance } from "./Attendance";
export function Login({
  onLogin,
  error,
}: {
  onLogin: (path: string, data: any) => Promise<void>;
  error: string;
}) {
  const [demo, setDemo] = useState(false),
    [busy, setBusy] = useState(false),
    [request, setRequest] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    api("/config")
      .then((c) => setDemo(c.demo))
      .catch(() => {});
  }, []);
  return (
    <div className="login-page">
      <div className="login-story">
        <a className="brand" href="#">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          Devicedisk crm.
        </a>
        <div>
          <span className="eyebrow">YOUR TEAM, IN SYNC</span>
          <h1>
            A clearer view.
            <br />A better workday.
          </h1>
          <p>
            Bring your people, their progress, and a little peace of mind into
            one connected workspace.
          </p>
          <div className="login-illustration">
            <div className="floating-card">
              <CheckCircle2 size={24} />
              <span>
                <strong>Everyone, on the same page.</strong>
                <small>Attendance · Work · Security</small>
              </span>
            </div>
            <div className="mini-chart">
              {[40, 70, 55, 90, 75, 95, 83].map((h, i) => (
                <i key={i} style={{ height: h + "%" }} />
              ))}
            </div>
            <span className="illustration-caption">
              Good work starts with a clear picture.
            </span>
          </div>
        </div>
        <span className="login-foot">
          <ShieldCheck size={16} /> Built for trusted teams and company devices.
        </span>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <span className="login-lock">
            <LockKeyhole size={25} />
          </span>
          <h2>
            {pending
              ? "Waiting for laptop approval"
              : request
                ? "Register your workstation"
                : "Welcome to your workspace"}
          </h2>
          <p>
            {pending
              ? "Your request is saved. Once your admin approves it, sign in below."
              : request
                ? "Request administrator approval for this company device."
                : "A productive day starts here. Sign in to continue."}
          </p>
          {demo && !request && (
            <div className="demo-box">
              <span>EXPLORE THE LOCAL DEMO</span>
              <div className="button-row">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onLogin("/auth/demo", { role: "admin" });
                    } catch {
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Admin dashboard <ArrowRight size={16} />
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onLogin("/auth/demo", { role: "employee" });
                    } catch {
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Employee view
                </button>
              </div>
              <small>Fictional data · Local preview only</small>
            </div>
          )}
          <form
            className="form"
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              const data = Object.fromEntries(new FormData(e.currentTarget));
              try {
                // Even on the request screen, a verified admin signs in directly.
                try {
                  await onLogin("/auth/login", data);
                } catch (loginError: any) {
                  if (!request || !loginError.deviceRequired) throw loginError;
                  const r = await api("/auth/request-device", "POST", {
                    ...data,
                    fingerprint: `${navigator.language}|${screen.width}x${screen.height}`,
                  });
                  setMessage(r.message);
                  setRequest(false);
                  setPending(r.deviceStatus === "Pending");
                }
              } catch (e: any) {
                setMessage(e.message);
                setPending(e.deviceStatus === "Pending");
                setRequest(e.deviceRequired === true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Work email
              <input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </label>
            {request && (
              <>
                <label>
                  Company device name
                  <input
                    name="name"
                    placeholder="e.g. Dell Latitude · IT-042"
                  />
                </label>
                <label>
                  Operating system
                  <select name="os">
                    <option>Windows 11</option>
                    <option>Windows 10</option>
                    <option>macOS</option>
                    <option>Linux</option>
                  </select>
                </label>
              </>
            )}
            {(message || error) && (
              <div className="info-box" role="alert">
                {message || error}
              </div>
            )}
            <button className="button primary login-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : pending
                  ? "Check approval and sign in"
                  : request
                    ? "Request device access"
                    : "Sign in to workspace"}
              <ArrowRight size={16} />
            </button>
          </form>
          <button
            className="text-button login-request"
            onClick={() => {
              setRequest(!request);
              setMessage("");
              setPending(false);
            }}
          >
            {request ? (
              <>
                <ArrowLeft size={15} />
                Back to sign in
              </>
            ) : (
              <>
                Using a new company laptop? Request access{" "}
                <ArrowUpRight size={14} />
              </>
            )}
          </button>
          <p className="login-policy">
            <ShieldCheck size={15} /> Admins sign in directly. Employees need an
            approved device.
          </p>
        </div>
      </div>
    </div>
  );
}
