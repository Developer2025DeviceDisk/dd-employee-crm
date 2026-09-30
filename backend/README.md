# Workpulse backend

Express + TypeScript with MongoDB/Mongoose support and a local JSON demo store.

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
