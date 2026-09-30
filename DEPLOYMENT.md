# Deploy DeviceDisk CRM: Vercel frontend + Render backend

This guide is specific to this repository. Deploy both folders from the same Git repository. The frontend calls the backend directly; **no Vite or Vercel API proxy is needed**.

```text
Browser → Vercel (frontend)
Browser → Render /api (backend) → MongoDB Atlas
```

## 1. Prepare the repository

Push the current project to your Git repository, including both package lockfiles. Do not commit `backend/.env`, `frontend/.env`, `node_modules`, `data`, or `dist`; these are ignored by Git. Use the hosting dashboards to enter environment variables.

The unnecessary `workpulse-crm: file:..` dependencies have been removed from both apps so each folder can be installed independently. Render cannot access files outside a configured root directory. [Render monorepo documentation](https://render.com/docs/monorepo-support)

Optional local checks from the project root:

```powershell
npm run setup
npm run build
npm test
```

## 2. Prepare MongoDB Atlas

Use the existing `workpulse` database if you want to retain your seeded administrator and employee records. MongoDB database-user credentials are different from CRM admin sign-in credentials.

In Atlas, verify the database user under **Database Access**. Your connection string must include the intended database:

```text
mongodb+srv://<database-user>:<URL-encoded-database-password>@cluster0.41o5z9h.mongodb.net/workpulse?appName=Cluster0
```

Replace both placeholders. Percent-encode special characters in the database password. Paste the complete URI only into Render's `MONGODB_URI` setting, never into Vercel or frontend source code.

After creating the Render service below, find its **Outbound IP Addresses** and add all listed ranges to Atlas **Network Access → IP Access List**. Render can use any address in those ranges. If the initial deploy cannot connect, add these ranges and redeploy. [Render outbound IP documentation](https://render.com/docs/outbound-ip-addresses), [Atlas access list documentation](https://www.mongodb.com/docs/atlas/security/ip-access-list/)

## 3. Deploy the backend on Render

1. Open the Render Dashboard and choose **New → Web Service**.
2. Connect the Git repository and select the deployment branch.
3. Enter these settings:

| Setting | Value |
| --- | --- |
| Service name | For example, `devicedisk-api` |
| Runtime | Node |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/config` |

The `--include=dev` flag is intentional: the current backend starts TypeScript with `tsx`, which is listed in devDependencies. Its build command type-checks the server; it does not emit a JavaScript `dist` folder. Do not use `node dist/app.js` or `npm run dev` as the Render start command. These settings follow Render's [Node/Express deployment flow](https://render.com/docs/deploy-node-express-app).

### Render environment variables

Add each name and value separately, without surrounding quotation marks:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `false` |
| `MONGODB_URI` | Your complete Atlas URI with `/workpulse` |
| `APP_ORIGIN` | Your frontend HTTPS origin, e.g. `https://devicedisk-crm.vercel.app` |
| `ADMIN_EMAIL` | `devicediskdeveloper@gmail.com` |
| `ADMIN_PASSWORD` | Your chosen admin password, at least 12 characters |
| `HOST` | `0.0.0.0` |

Do not set `PORT=4000` in Render. The application already reads Render's assigned `PORT` and listens on `0.0.0.0`.

If Vercel has not assigned your frontend URL yet, use your intended HTTPS frontend URL for `APP_ORIGIN`, then replace it with the actual URL in step 5. This app currently validates that the value starts with `https://`; it is not being used as a CORS allowlist.

Choose an always-on Render instance for regular employee use. A Free service sleeps after 15 minutes without inbound traffic, so the in-process 7 PM job cannot execute while it is asleep. The application reconciles overdue sessions when it restarts, but notifications and closure processing will be delayed. Keep this application at **one running instance** because its job coordination and rate limits are currently process-local. [Render Free service behavior](https://render.com/docs/free)

Click **Create Web Service**, complete the Atlas access list step, and wait for a successful deployment. Copy the exact Render URL; the service name alone does not guarantee the final URL.

Verify:

```text
https://YOUR-ACTUAL-BACKEND.onrender.com/api/config
```

Expected response:

```json
{"demo": false}
```

Use `/api/config`, not `/`, to check the API. The root URL is intended to serve a locally built frontend, which is not deployed inside the backend on Render.

## 4. Deploy the frontend on Vercel

1. Open Vercel and choose **Add New → Project**.
2. Import the same Git repository.
3. Set:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `frontend` |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Add this environment variable to **Production** before deploying:

```dotenv
VITE_API_URL=https://YOUR-ACTUAL-BACKEND.onrender.com
```

Use the real HTTPS Render origin. Do not use `localhost`, `127.0.0.1`, or the Vercel frontend URL here. The frontend appends `/api` itself. No database credentials or admin passwords belong in Vercel variables.

Click **Deploy**, then copy the assigned Vercel frontend URL. These settings use Vercel's [Vite support](https://vercel.com/docs/frameworks/frontend/vite) and [root-directory/build settings](https://vercel.com/docs/builds/configure-a-build).

`VITE_API_URL` is compiled into the frontend at build time. After changing it, **redeploy the frontend**; refreshing an existing deployment is not enough. If you use Preview deployments, configure a Preview value separately, preferably pointing at a separate test backend/database. [Vercel environment variable updates](https://vercel.com/docs/environment-variables/managing-environment-variables)

## 5. Connect the final URLs

Check that these values point in opposite directions:

| Location | Variable | Points to |
| --- | --- | --- |
| Vercel frontend | `VITE_API_URL` | Render backend HTTPS origin |
| Render backend | `APP_ORIGIN` | Vercel frontend HTTPS origin |

Update Render's `APP_ORIGIN` with the exact Vercel URL and save/redeploy the backend. Redeploy Vercel if its API URL changed.

Example only:

```text
Vercel: VITE_API_URL=https://devicedisk-api-example.onrender.com
Render: APP_ORIGIN=https://devicedisk-crm-example.vercel.app
```

### Session cookies and reliable sign-in

The frontend already uses `credentials: "include"`; production session/device cookies already use `HttpOnly`, `Secure`, and `SameSite=None`. However, `*.vercel.app` and `*.onrender.com` are different sites. Browsers that block third-party cookies can still reject these cookies, causing login or device approval loops even when the API returns 200. CORS cannot override a browser's cookie policy. [MDN CORS and third-party cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

For reliable employee access, use HTTPS subdomains of the same domain:

```text
Frontend on Vercel: https://crm.yourcompany.com
Backend on Render: https://api.yourcompany.com
```

Add each custom domain in its hosting dashboard and create the DNS records that dashboard provides. Once HTTPS is active, set Vercel's `VITE_API_URL` to `https://api.yourcompany.com` and Render's `APP_ORIGIN` to `https://crm.yourcompany.com`, then redeploy. This retains a direct browser-to-backend connection without introducing a proxy. Changing the API hostname changes its cookie storage, so employees must register their browser again on the new hostname.

The backend currently accepts credentialed requests from **every origin**, as previously requested. Setting `APP_ORIGIN` does not restrict that policy. For real staff data, this permits unrelated websites to read authenticated responses when cookies are sent; a production origin allowlist is recommended. The deployment steps above do not silently change that policy.

## 6. Admin account and employee onboarding

If Render uses the same Atlas `workpulse` database as your local configuration, your existing admin already exists. Sign in with your admin email and its existing password. Changing `ADMIN_PASSWORD` in Render alone does **not** reset an existing account.

On a completely empty database, server startup creates the initial admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. To explicitly create/update the admin in an existing database, run this once in a Render shell if available:

```sh
npm run seed:admin
```

Alternatively, run it locally from `backend` with `backend/.env` pointing at the intended Atlas database. The seed command resets that admin password and invalidates its current sessions; do not add it to the regular build or start command. Existing non-admin employees are preserved.

Do not publish passwords in the repository or this guide. Previously shared credentials should be replaced for production.

Employee flow:

1. Admin signs in and creates the employee account.
2. Employee uses the final frontend URL in their regular company-laptop browser.
3. Employee submits the device request once.
4. Admin approves the device from **Devices**.
5. Employee clicks **Check approval and sign in** from the same browser.

## 7. Verify the deployment

- Open the Render `/api/config` URL and confirm `demo: false`.
- Open the Vercel frontend and sign in as admin.
- In browser DevTools → Network, confirm requests target the Render/custom API URL, not the Vercel origin or localhost.
- Confirm `/api/auth/login` returns 200 and the following `/api/state` request also returns 200.
- Log out and sign in again to confirm the session/device flow.
- Complete an employee request/approval/sign-in cycle on the final hostname.
- Check Attendance and Reports for a full selected month and weekend exclusions.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `tsx: not found` | Use `npm ci --include=dev` in Render's build command. |
| `ENOENT` mentioning a parent `package.json` | Deploy the latest manifests/lockfiles without `workpulse-crm: file:..`. |
| Production configuration error | Set `MONGODB_URI`, `DEMO_MODE=false`, and an HTTPS `APP_ORIGIN`. |
| MongoDB authentication failure | Check the Atlas database user/password, not the CRM login password. |
| MongoDB timeout | Add all Render outbound ranges to the Atlas access list and verify the cluster is available. |
| Root backend page errors | Test `/api/config`; the frontend lives on Vercel. |
| Requests still target localhost or Vercel | Correct `VITE_API_URL` and redeploy Vercel. |
| Login is 200 but `/api/state` is 401 | Inspect blocked-cookie messages; use same-domain HTTPS subdomains. |
| Repeated device requests after moving domains | Cookies belong to the old API hostname; approve the new browser credential once. |
| First request is slow or fails | Wait for the Render backend to finish starting; Free instances can sleep. |
| Auto-close/alerts run late | Use an always-on instance; jobs do not execute while the API is stopped. |

No live deployment is performed by adding this guide. All example hostnames must be replaced with the URLs assigned to your projects.
