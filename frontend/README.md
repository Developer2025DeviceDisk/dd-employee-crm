# Workpulse frontend

React + TypeScript + Vite. All UI code and frontend configuration live here.

## Project workflow

1. Employees open **My workspace**; admins open **Work monitoring**.
2. Choose **Create project**, then open its card. Employees can keep multiple projects active.
3. Choose **Add task** and enter its name, description, estimate, and priority.
4. Open a task to update its status or **Log work** with a date, minutes spent, and work details. Changing status does not start a timer.
5. **Daily work progress** totals work across projects for the selected date and shows progress toward 8 hours. Days off have no target.
6. Each project shows total logged time, total tasks, completed tasks, in-progress tasks, pending tasks, and its work-log history. Admins can monitor all employees.

Work-log time is entered manually; estimates are never automatically counted as work. Imported historical totals are labeled in the log table. Attendance reports continue to describe login/logout attendance separately from logged task work.

```text
frontend/
  src/
    components/      Reusable UI, dialogs, chart, and team table
    pages/           Login, employees, attendance, work, reports, settings
    services/api.ts  Backend requests, session CSRF token, CSV export
    styles/          Responsive application styles
    types/           Public API data types (no server imports)
    App.tsx          Application shell and connected workflows
    main.tsx         React entry point
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  package-lock.json
  .env.example
  dist/              Generated production assets
```

Run from this folder:

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173. Start the backend separately on port 4000, or use `npm run dev` from the project root to start both.

The frontend calls `https://dd-employee-crm.onrender.com/api` directly by default in development and production, with no proxy. Cookies are included in cross-origin requests. `VITE_API_URL` can override this default; set it to `https://dd-employee-crm.onrender.com` in Vercel if the variable already exists. Restart Vite after editing this value and rebuild when deploying. Do not add passwords or server secrets to frontend environment variables.

`npm run build` type-checks and builds into `frontend/dist`. Deploy this folder through Vercel. Development, production, and preview all use the Render backend above when `VITE_API_URL` is unset. Preview does not proxy requests.

Wait for the `Workpulse API` startup message before signing in. During HTTP development, use the same hostname for both apps so cookies work (`localhost` with `localhost`, or `127.0.0.1` with `127.0.0.1`). For separate production domains, use HTTPS; production cookies use `SameSite=None; Secure`. Browser third-party cookie settings still apply. The API accepts all origins and reflects the requesting origin to support credentials, as required by the [browser CORS protocol](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
