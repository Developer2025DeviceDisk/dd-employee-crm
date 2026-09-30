# Workpulse backend

Express + TypeScript with MongoDB/Mongoose support and a local JSON demo store.

## Projects and work logs

Employees create their own projects and tasks. Admins can create projects for employees and view every project, task, and log. Tasks inherit the project's employee; an employee cannot access another employee's projects or logs.

- `POST /api/projects`: `name`, `description`, optional admin-only `employeeId`.
- `POST /api/tasks`: `projectId`, `title`, `description`, `estimatedMinutes`, `priority`.
- `PATCH /api/tasks/:id`: `status` (`Pending`, `In Progress`, `Completed`, or `Blocked`) and comments. Status changes never run a timer.
- `POST /api/tasks/:id/logs`: UUID `id`, `date` (`YYYY-MM-DD`, Asia/Kolkata), integer `minutes`, and `details`. Reuse the same ID when retrying the same submission. Logs cannot be future-dated, precede joining, or exceed 24 hours per employee/day across all projects.
- `GET /api/state`: includes scoped `projects` with task counts/time totals, `workLogs`, and today's `dailyWork` summary. Task time is the sum of its work logs.

Daily logged-work progress uses an **8-hour** target across all projects. Weekends, configured holidays, and other configured days off have no target or shortfall; any optional logs on those dates remain visible for project history but do not count toward required daily work. Attendance login/logout records and their existing monthly reports retain their separate attendance calculations.

On startup, existing tasks without projects move into an employee-owned **Existing work** project. Previously saved task minutes become an imported work-log entry on the original task date, explicitly marked because an original daily breakdown is unavailable. Running timers are stopped; time since their last saved value is not invented. Migration uses deterministic IDs so retries do not duplicate imported entries. No employee, task, or attendance history is deleted.

Deploy the updated backend before the frontend so the project/log fields and endpoints exist.

```text
backend/
  src/
    config/          Environment loading and application paths
    controllers/     API endpoints and validation
    middleware/      Authentication and role/device authorization
    models/          Server types and persistence
    services/        Attendance rules, reports, jobs, seeding
    app.ts           Server entry point
  tests/             API integration and attendance-rule tests
  data/              Local demo data (ignored by Git)
  .env.example
  package.json
  package-lock.json
  tsconfig.json
```

Run from this folder:

```powershell
npm install
npm run dev
```

The API listens on http://127.0.0.1:4000. Use `npm start` without file watching, `npm run build` for type checking, and `npm test` for the automated tests.

Copy `.env.example` to `.env` for configuration. Environment loading and the default data path resolve relative to this backend folder, independent of the shell's current directory. Existing demo records are retained in `backend/data/workpulse.json`.

To provision the configured admin in MongoDB, set `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `backend/.env`, then run `npm run seed:admin` from this folder. This explicit command creates the admin or updates that admin's password, invalidating existing sessions. It preserves other employees and refuses to promote an existing employee account. Normal server startup does not reset existing passwords. With `DEMO_MODE=false`, no demo access buttons or fictional employees are created. Every successful admin sign-in grants direct dashboard access and registers or renews the browser credential as needed. Employees still need device approval. Admin roles are loaded from the database after password verification.

The server serves built frontend files from `../frontend/dist`. Build the frontend first when running a single-server preview. See the root README for production security, device enrollment, and deployment limitations.
