# Workpulse — Employee Attendance & Work Monitoring CRM

For hosting, follow the [Vercel frontend + Render backend deployment guide](DEPLOYMENT.md), including exact build commands, environment variables, MongoDB setup, and connection steps.

A working full-stack CRM built from the supplied project brief. Includes an admin dashboard and a separate employee workspace, server-side attendance calculations, device approvals, work monitoring, monthly CSV reports, security events, and audit history.

The main directory has exactly two folders: **frontend** and **backend**. Each owns its package manifest, lockfile, dependencies, TypeScript configuration, and documentation. Root files provide project documentation and commands to run both together; there are no root-level dependencies or application source folders.

See [frontend setup and structure](frontend/README.md) and [backend setup and structure](backend/README.md). The frontend calls `https://dd-employee-crm.onrender.com/api` directly by default in development and production. `VITE_API_URL` can override this origin. No proxy is used. To connect to a local backend instead, explicitly set `VITE_API_URL=http://127.0.0.1:4000` before starting or building the frontend.

## Run locally

Requires Node.js 20 or later and npm.

```powershell
npm run setup
npm run build
npm start
```

Open **http://127.0.0.1:4000**. Choose **Admin dashboard** or **Employee view** to explore the local demo. Demo access is intentionally passwordless and only available outside production. Sample employees and historical attendance are fictional. Demo data persists in `backend/data/workpulse.json`.

For frontend development with hot reload:

```powershell
npm run dev
```

Open http://127.0.0.1:5173. The frontend calls port 4000 directly; configure `VITE_API_URL` in `frontend/.env` for a different backend. Stop an existing server on port 4000 before using this command.

The default local credentials are `admin@workpulse.local` / `Workpulse@2026`. Sample employee credentials are `rahul.sharma@workpulse.local` / `Employee@2026`; normal employee sign-in still requires an approved browser. These credentials are exclusively for the demo.

## Included workflows

- **Overview:** attendance statistics, weekly chart, task overruns, blocked work, pending device requests, employee search, and daily attendance export.
- **Employees:** create and edit profiles, activate/deactivate accounts, delete employee accounts, inspect individual attendance and activity history. Deactivation invalidates sessions; deletion revokes devices and retains historical audit data.
- **Device enrollment:** employee authenticates to request access; the server issues a random credential in an HttpOnly cookie; an administrator verifies the physical company laptop and approves or rejects the request. The same browser must then sign in. Revocation takes effect on the next API request.

Device cookies are scoped to each account, so switching between admin and employee in the same browser preserves both device credentials. Pending requests display a waiting state; after approval, select **Check approval and sign in** without entering the laptop name again. Repeated requests reuse the existing device record and never replace an approved credential. Existing valid legacy cookies migrate automatically on sign-in. Use the same browser profile and hostname throughout (`localhost` and `127.0.0.1` have separate cookies). If a credential was previously overwritten or cookies were deleted, a new device request must be approved once; approval is not inferred from an employee name or fingerprint.
- **Attendance:** normal employee sign-in starts attendance, with explicit check-in available in the employee workspace. Exact timestamps, late entries, break start/end, manual checkout, server-side scheduled closure, effective hours, and daily difference are recorded.
- **Work:** assign/create tasks, set estimates and priorities, start/block/complete tasks, review elapsed time, and add employee/admin comments. Time is calculated on the server. Overruns flag a need for review and are not automatic performance ratings.
- **Reports:** employee-specific monthly attendance, required/actual hours, shortfall, late entries, present/absent days, daily work summaries, and spreadsheet-safe CSV exports. Working-day totals stop at today and exclude configured holidays and dates before joining.
- **Security:** account and device enforcement on every authenticated API call, blocked login events, security review, rate limits, and audit history. Employees receive only their own records.
- **Notifications:** logins, lateness, automatic logout, absent employees, missing daily reports, task overruns, blocked/completed tasks, and new device requests.
- **Settings:** office start/end, late threshold, required hours, planned breaks, working days, holidays, and task-overrun grace period.

## Attendance policy

The employee Attendance page defaults to a complete monthly calendar. Choose a month to see every date and select any day for its check-in, checkout, breaks, effective hours, and difference. The summary shows the full month's scheduled working days, present days, absences, late entries, leave days, half days, and attendance percentage. CSV export includes every calendar day.

Admins can open **Attendance → Monthly employee view**, select an employee and day, and record **Leave** or **Half Day** with a note. **Automatic** removes that override and restores the session/calendar-derived status. Overrides are stored separately in `attendance_adjustments` and audited; they do not alter recorded session timestamps or durations. Employees cannot change these records.

Present includes late and half-day attendance. Percentage = `(present days − 0.5 × half days) / elapsed working days × 100`; leave receives zero attendance credit. Future dates, holidays, weekly offs, and dates before joining are excluded from the denominator. Today without a check-in remains **Not checked in** until office closing, then becomes **Absent**. An open or short session is never automatically classified as Half Day. Planned future leave is visible in the calendar but is counted in summary attendance only when its date arrives.

All business-day calculations use **Asia/Kolkata**. Defaults:

Saturday and Sunday are fixed weekly offs, enforced even if older stored settings include them. They never count toward working days, absences, late totals, attendance percentage, required/actual working hours, averages, or shortfall. Historical weekend sessions retain their raw timestamps and session duration for audit, but their counted working minutes, target, and difference are zero. Weekend check-in and Leave/Half Day overrides are disabled. Settings cannot re-enable weekends as working days.

- On time: at or before **10:15:00 AM**; early login is allowed and recorded.
- Late: strictly after **10:15:00 AM**.
- Automatic attendance closure: **7:00 PM**. Active employee authentication sessions are invalidated when the automatic closure job runs.
- Daily target: **9 hours**.
- Effective minutes = actual bounded session duration minus actual recorded breaks.
- Planned break minutes are informational and are not automatically deducted.
- Overtime after 7 PM requires an administrator to configure a later closing time. This resolves the brief's 7 PM auto-close rule versus its 7:30 PM overtime example.

Attendance currently supports one continuous session per employee per day, with multiple breaks. Checking out completes that day; signing back in does not restart attendance. In-progress task timers measure elapsed task time until a status change, independently of attendance and breaks. Stop or block tasks when work pauses.

## Production configuration

Copy `backend/.env.example` to `backend/.env` and configure a **fresh production database**:

```dotenv
NODE_ENV=production
DEMO_MODE=false
PORT=4000
APP_ORIGIN=https://crm.yourcompany.com
MONGODB_URI=mongodb://127.0.0.1:27017/workpulse_production
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your-unique-random-password-at-least-12-characters
```

Build with `npm run build` and run with `npm start`. Startup refuses production without MongoDB, an HTTPS origin, and explicitly disabled demo mode. The initial admin password is required when initializing an empty database. Do not reuse a demo database for production.

Run behind one trusted HTTPS reverse proxy, bind the upstream port to a private interface/network, and prevent direct public access to the API port. The app trusts one proxy hop in production. Keep the process running using your deployment platform's service manager. Use a MongoDB account limited to the application's database and configure backups and retention with your hosting provider.

Active administrators sign in directly with their stored email and bcrypt-verified password, including from a new browser. The server issues or renews that browser's approved device credential and records an audit event. Administrator status is read from the database; neither a matching email alone nor a frontend role value grants admin access. Employees still require company-device approval and cannot use mobile browsers. Device revocation invalidates an existing admin session, but correct admin credentials can enroll the browser again on the next sign-in. The frontend selects the Admin Dashboard or employee workspace from the authenticated server response.

Passwords use bcrypt. Authentication uses opaque, hashed server-side sessions with a 12-hour absolute lifetime, token rotation every 15 minutes, HttpOnly/SameSite cookies, production Secure cookies, CSRF tokens, credentialed CORS for all origins, JSON-only mutations, input validation, Helmet headers, and rate limiting. Session authentication replaces the need for JWT refresh tokens in this implementation. There is no password-reset/email delivery integration yet.

Browser device credentials are revocable bearer credentials, not hardware attestation. User-agent checks block ordinary mobile browsers, but cannot prove hardware identity or prevent a copied credential on their own. For the brief's strict company-device guarantee, deploy client-certificate/mTLS enforcement, managed-device conditional access, or a company agent at the access boundary. Fingerprints are contextual metadata, never authorization evidence. MAC addresses are not used.

## Architecture and current deployment limits

```text
frontend/src/components/     Shared UI components and dashboard widgets
frontend/src/pages/          Frontend page components and forms
frontend/src/services/       API client and export helpers
frontend/src/styles/         Responsive styles
frontend/src/types/          Public API data types
backend/src/config/          Environment and stable application paths
backend/src/controllers/     Validated API endpoints
backend/src/middleware/      Sessions, device checks, role access
backend/src/models/          Domain types, MongoDB/local persistence
backend/src/services/        Attendance rules, jobs, reports, seeding
backend/tests/               Business-rule and HTTP integration tests
backend/data/                Persistent local demo data
```

MongoDB collections are `employees`, `devices`, `attendance`, `tasks`, `daily_reports`, `settings`, `sessions`, `notifications`, `security_events`, and `audit_logs`. Accounts and employee profiles are consolidated in `employees`. Mongoose indexes cover record IDs, employees, dates, status, creation time, unique email, unique daily attendance, and session credentials. The local JSON adapter is for demo/development only.

This is a **single-instance initial implementation**, not a horizontally scaled deployment. The API serializes requests and job passes. Scheduled processing runs every 30 seconds in the backend, independently of browsers, and closes overdue open sessions on startup. If the API is offline at closing time, sessions are reconciled on restart. The interface refreshes every 30 seconds and after mutations.

The brief's suggested BullMQ/Redis workers and Socket.IO transport are not installed in this version. Distributed jobs, database transactions spanning multiple writes, shared rate-limit storage, push updates, historical policy versioning, multiple daily work sessions, leave approvals, password recovery, managed-device attestation, and backup automation remain deployment/next-phase work. Policy edits currently affect report calculations for historical sessions, so do not change a policy mid-reporting period if immutable historical policy accounting is required.

## Verification

```powershell
npm run build
npm test
```

Ten automated tests cover monthly calendars, leave and half-day accounting, future-date handling,  timezone and late boundaries, shortfall and breaks, automatic cutoff, configured overtime, task durations, workday calendars, plus an isolated HTTP integration workflow covering authentication, CSRF, device approval/revocation, role restrictions, cross-employee isolation, task updates, reports, and logout. The integration test starts a temporary API on port 14287 and cleans up its temporary data. MongoDB production connectivity and browser visual rendering still need verification in the deployment environment.

Security implementation references: [Express production security guidance](https://expressjs.com/en/advanced/best-practice-security.html) and [Mongoose connection documentation](https://mongoosejs.com/docs/connections.html).
#   d d - e m p l o y e e - c r m  
 #   d d - e m p l o y e e - c r m  
 
