# Workpulse frontend

React + TypeScript + Vite. All UI code and frontend configuration live here.

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

The frontend calls the backend directly, with no Vite proxy. In development, the default API URL uses the frontend's hostname on port 4000 (for example `http://127.0.0.1:4000/api`). Cookies are included in cross-origin requests. To use another backend, copy `.env.example` to `.env` and set `VITE_API_URL` to its origin, such as `https://api.company.com`. Restart Vite after editing this value and rebuild when deploying. Do not add passwords or server secrets to frontend environment variables.

`npm run build` type-checks and builds into `frontend/dist`. The backend serves that folder at http://127.0.0.1:4000. Production builds default to the page's origin when `VITE_API_URL` is unset. For `npm run preview` on a separate port, build with `VITE_API_URL` configured. Preview does not proxy requests.

Wait for the `Workpulse API` startup message before signing in. During HTTP development, use the same hostname for both apps so cookies work (`localhost` with `localhost`, or `127.0.0.1` with `127.0.0.1`). For separate production domains, use HTTPS; production cookies use `SameSite=None; Secure`. Browser third-party cookie settings still apply. The API accepts all origins and reflects the requesting origin to support credentials, as required by the [browser CORS protocol](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
