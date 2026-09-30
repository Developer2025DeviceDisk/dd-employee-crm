import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
test("authentication, device approval, employee isolation, CSRF, and mutations", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workpulse-test-"));
  const port = 14287;
  const start = () =>
    spawn(process.execPath, ["--import", "tsx", "src/app.ts"], {
      env: {
        ...process.env,
        PORT: String(port),
        DATA_FILE: path.join(dir, "test.json"),
        DEMO_MODE: "true",
        NODE_ENV: "test",
        MONGODB_URI: "",
        ADMIN_EMAIL: "admin@workpulse.local",
        ADMIN_PASSWORD: "Workpulse@2026",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  let child = start();
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  const client = () => {
    const cookies = new Map<string, string>();
    let csrf = "";
    const request = async (
      url: string,
      method = "GET",
      data?: any,
      headers: Record<string, string> = {},
    ) => {
      const r = await fetch(`http://127.0.0.1:${port}/api${url}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://another-frontend.example",
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          "X-CSRF-Token": csrf,
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      for (const c of r.headers.getSetCookie()) {
        const [name, ...value] = c.split(";")[0].split("=");
        cookies.set(name, value.join("="));
      }
      const body: any = await r.json().catch(() => null);
      if (body?.csrf) csrf = body.csrf;
      return { status: r.status, body };
    };
    return Object.assign(request, {
      useLegacyEmployeeCookie: () => {
        const name = `wp_device_${createHash("sha256").update("emp-1").digest("hex").slice(0, 24)}`;
        const token = cookies.get(name);
        assert.ok(token);
        cookies.delete(name);
        cookies.set("wp_device", token);
      },
    });
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/config`);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.ok(ready, logs);
    for (const origin of [
      "http://localhost:5173",
      "https://another-frontend.example",
      "https://unlisted.example:8443",
    ]) {
      const preflight = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(
        preflight.headers.get("access-control-allow-origin"),
        origin,
      );
      assert.equal(
        preflight.headers.get("access-control-allow-credentials"),
        "true",
      );
      assert.match(
        preflight.headers.get("access-control-allow-headers") || "",
        /X-CSRF-Token/i,
      );
      const unauthorized = await fetch(`http://127.0.0.1:${port}/api/state`, {
        headers: { Origin: origin },
      });
      assert.equal(unauthorized.status, 401);
      assert.equal(
        unauthorized.headers.get("access-control-allow-origin"),
        origin,
      );
    }
    const admin = client(),
      employee = client(),
      outsider = client();
    assert.equal((await outsider("/state")).status, 401);
    assert.equal(
      (await admin("/auth/demo", "POST", { role: "admin" })).status,
      200,
    );
    const a = (await admin("/state")).body;
    assert.equal(a.user.role, "admin");
    assert.ok(a.employees.length > 10);
    assert.ok(a.employees.every((e: any) => !("passwordHash" in e)));
    assert.ok(a.devices.every((d: any) => !("tokenHash" in d)));
    // An existing admin device must not force a different browser to request approval.
    const adminCredentials = {
      email: "admin@workpulse.local",
      password: "Workpulse@2026",
    };
    const freshAdmin = client();
    assert.equal(
      (
        await freshAdmin("/auth/login", "POST", {
          ...adminCredentials,
          password: "incorrect-password",
        })
      ).status,
      401,
    );
    const signedIn = await freshAdmin("/auth/login", "POST", {
      ...adminCredentials,
      email: " ADMIN@WORKPULSE.LOCAL ",
    });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.user.role, "admin");
    assert.equal((await freshAdmin("/state")).body.user.role, "admin");
    assert.equal((await freshAdmin("/auth/logout", "POST", {})).status, 200);
    assert.equal(
      (await freshAdmin("/auth/login", "POST", adminCredentials)).status,
      200,
    );
    const anotherBrowser = client();
    assert.equal(
      (
        await anotherBrowser("/auth/login", "POST", adminCredentials, {
          "User-Agent": "Mozilla/5.0 Android Mobile",
        })
      ).status,
      200,
    );
    assert.equal((await anotherBrowser("/state")).body.user.role, "admin");
    assert.equal(
      (
        await freshAdmin("/auth/request-device", "POST", {
          ...adminCredentials,
          name: "Unnecessary admin request",
          os: "Windows 11",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await outsider("/auth/login", "POST", {
          email: "rahul.sharma@workpulse.local",
          password: "Employee@2026",
          role: "admin",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await admin(
          "/employees/emp-1",
          "PATCH",
          { status: "Inactive" },
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await outsider("/auth/login", "POST", {
          email: "rahul.sharma@workpulse.local",
          password: "Employee@2026",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await outsider("/auth/request-device", "POST", {
          email: "rahul.sharma@workpulse.local",
          password: "Employee@2026",
          name: "Company test laptop",
          os: "Windows 11",
        })
      ).status,
      200,
    );
    const requested = (await admin("/state")).body.devices.find(
      (d: any) => d.name === "Company test laptop",
    );
    assert.equal(requested.status, "Pending");
    const employeeCredentials = {
      email: "rahul.sharma@workpulse.local",
      password: "Employee@2026",
    };
    const pendingLogin = await outsider(
      "/auth/login",
      "POST",
      employeeCredentials,
    );
    assert.equal(pendingLogin.body.deviceStatus, "Pending");
    assert.equal(pendingLogin.body.deviceRequired, false);
    // Retrying a saved request needs no laptop name and keeps the same record.
    assert.equal(
      (await outsider("/auth/request-device", "POST", employeeCredentials)).body
        .deviceStatus,
      "Pending",
    );
    // Switching to admin in this same browser must preserve the employee credential.
    assert.equal(
      (await outsider("/auth/login", "POST", adminCredentials)).status,
      200,
    );
    assert.equal((await outsider("/auth/logout", "POST", {})).status, 200);
    assert.equal(
      (await admin(`/devices/${requested.id}`, "PATCH", { status: "Approved" }))
        .status,
      200,
    );
    const approvedRetry = await outsider(
      "/auth/request-device",
      "POST",
      employeeCredentials,
    );
    assert.equal(approvedRetry.body.deviceStatus, "Approved");
    assert.equal(
      (await admin("/state")).body.devices.filter(
        (d: any) => d.name === "Company test laptop",
      ).length,
      1,
    );
    assert.equal(
      (
        await outsider("/auth/login", "POST", {
          email: "rahul.sharma@workpulse.local",
          password: "Employee@2026",
        })
      ).status,
      200,
    );
    assert.equal((await outsider("/state")).body.user.role, "employee");
    assert.equal((await outsider("/auth/logout", "POST", {})).status, 200);
    assert.equal(
      (await outsider("/auth/login", "POST", employeeCredentials)).status,
      200,
    );
    outsider.useLegacyEmployeeCookie();
    assert.equal(
      (await outsider("/auth/login", "POST", employeeCredentials)).status,
      200,
    );
    assert.equal((await outsider("/state")).body.user.role, "employee");
    assert.equal(
      (await client()("/auth/login", "POST", employeeCredentials)).status,
      403,
    );
    assert.equal(
      (await employee("/auth/demo", "POST", { role: "employee" })).status,
      200,
    );
    const e = (await employee("/state")).body;
    assert.equal(e.employees.length, 1);
    assert.ok(e.attendance.every((a: any) => a.employeeId === e.user.id));
    assert.equal(e.security.length, 0);
    assert.equal((await employee("/employees", "POST", {})).status, 403);
    assert.equal(
      (await employee("/tasks/task-1", "PATCH", { status: "Completed" }))
        .status,
      404,
    );
    // Existing tasks/time are migrated before serving requests.
    assert.ok(e.tasks.every((t: any) => t.projectId && t.startedAt === null));
    assert.ok(e.projects.every((p: any) => p.employeeId === e.user.id));
    assert.ok(e.workLogs.every((l: any) => l.employeeId === e.user.id));
    const project = await employee("/projects", "POST", {
      name: "Employee project",
      description: "Multiple modules",
      employeeId: "emp-2",
    });
    assert.equal(project.status, 201);
    assert.equal(project.body.employeeId, e.user.id);
    const secondProject = await employee("/projects", "POST", {
      name: "Second project",
    });
    assert.equal(secondProject.status, 201);
    const foreignProject = a.projects.find(
      (p: any) => p.employeeId !== e.user.id,
    );
    assert.ok(foreignProject);
    assert.equal(
      (
        await employee("/tasks", "POST", {
          projectId: foreignProject.id,
          title: "Forbidden task",
          description: "No access",
          priority: "High",
          estimatedMinutes: 60,
        })
      ).status,
      404,
    );
    const created = await employee("/tasks", "POST", {
      projectId: project.body.id,
      title: "Integration check",
      description: "Test the new work log flow",
      priority: "High",
      estimatedMinutes: 60,
      employeeId: "emp-2",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.employeeId, e.user.id);
    assert.equal(
      (
        await employee(`/tasks/${created.body.id}`, "PATCH", {
          status: "In Progress",
          actualMinutes: 9000,
        })
      ).status,
      200,
    );
    const updated = (await employee("/state")).body.tasks.find(
      (t: any) => t.id === created.body.id,
    );
    assert.equal(updated.actualMinutes, 0);
    assert.equal(updated.startedAt, null);
    assert.equal(updated.elapsedMinutes, 0);
    const secondTask = await employee("/tasks", "POST", {
      projectId: secondProject.body.id,
      title: "Second module",
      description: "Parallel project",
      priority: "Medium",
      estimatedMinutes: 300,
    });
    assert.equal(secondTask.status, 201);
    assert.equal(secondTask.body.status, "Pending");
    const workDate = "2026-09-01";
    const log = {
      id: randomUUID(),
      date: workDate,
      minutes: 180,
      details: "Implemented the module",
    };
    const logPath = `/tasks/${created.body.id}/logs`;
    assert.equal((await employee(logPath, "POST", log)).status, 201);
    assert.equal((await employee(logPath, "POST", log)).status, 200);
    assert.equal(
      (await employee(logPath, "POST", { ...log, minutes: 181 })).status,
      409,
    );
    for (const invalid of [
      { minutes: 0 },
      { minutes: -1 },
      { minutes: 1.5 },
      { minutes: 1441 },
      { date: "2099-01-01" },
      { date: "2026-02-30" },
      { date: "2000-01-01" },
      { details: "" },
    ])
      assert.equal(
        (
          await employee(logPath, "POST", {
            ...log,
            id: randomUUID(),
            ...invalid,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await employee(logPath, "POST", {
          ...log,
          id: randomUUID(),
          minutes: 1300,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await employee(`/tasks/${secondTask.body.id}/logs`, "POST", {
          ...log,
          id: randomUUID(),
          minutes: 300,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await employee(
          `/tasks/${a.tasks.find((t: any) => t.employeeId !== e.user.id).id}/logs`,
          "POST",
          { ...log, id: randomUUID() },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await employee(`/tasks/${created.body.id}`, "PATCH", {
          status: "Completed",
        })
      ).status,
      200,
    );
    const afterLogs = (await employee("/state")).body;
    const ownProject = afterLogs.projects.find(
      (p: any) => p.id === project.body.id,
    );
    assert.equal(ownProject.totalMinutes, 180);
    assert.equal(ownProject.taskCount, 1);
    assert.equal(ownProject.completedCount, 1);
    assert.equal(
      afterLogs.tasks.find((t: any) => t.id === created.body.id).elapsedMinutes,
      180,
    );
    assert.equal(
      afterLogs.workLogs.filter((l: any) => l.id === log.id).length,
      1,
    );
    const adminView = (await admin("/state")).body;
    assert.equal(
      adminView.projects.find((p: any) => p.id === secondProject.body.id)
        .totalMinutes,
      300,
    );
    assert.equal(
      adminView.workLogs.find((l: any) => l.id === log.id).employeeId,
      e.user.id,
    );
    assert.equal(
      afterLogs.workLogs
        .filter(
          (l: any) =>
            l.date === workDate &&
            [created.body.id, secondTask.body.id].includes(l.taskId),
        )
        .reduce((sum: number, l: any) => sum + l.minutes, 0),
      480,
    );
    assert.equal(
      (
        await employee("/reports/daily", "POST", {
          summary: "Completed the integration checks for the CRM.",
          blockers: "",
        })
      ).status,
      200,
    );
    const report = (
      await employee("/reports/monthly?employeeId=emp-2&month=2026-09")
    ).body;
    assert.equal(report.employee.id, e.user.id);
    assert.equal(report.calendarRows.length, 30);
    assert.deepEqual(
      report.calendarRows.map((r: any) => r.date),
      Array.from(
        { length: 30 },
        (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`,
      ),
    );
    for (const row of report.rows) {
      const detail = report.calendarRows.find((d: any) => d.date === row.date);
      assert.equal(detail.loginTime, row.loginTime);
      assert.equal(detail.effectiveMinutes, row.effectiveMinutes);
      assert.equal(detail.difference, row.difference);
    }
    const february = (await employee("/reports/monthly?month=2026-02")).body;
    assert.equal(february.calendarRows.length, 28);
    assert.ok(
      february.calendarRows.every((r: any) => r.date.startsWith("2026-02-")),
    );
    const october = (await employee("/reports/monthly?month=2026-10")).body;
    assert.equal(october.calendarRows.length, 31);
    assert.ok(
      october.calendarRows.every((r: any) => r.date.startsWith("2026-10-")),
    );
    const beforeLeave = (
      await employee(`/reports/monthly?month=${e.today.slice(0, 7)}`)
    ).body;
    assert.equal(
      (
        await admin("/attendance/day-status", "PUT", {
          employeeId: e.user.id,
          date: "2026-09-05",
          status: "Leave",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin("/settings", "PUT", {
          ...a.settings,
          workingDays: [0, 1, 2, 3, 4, 5, 6],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await employee("/attendance/day-status", "PUT", {
          employeeId: e.user.id,
          date: e.today,
          status: "Leave",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await admin("/attendance/day-status", "PUT", {
          employeeId: e.user.id,
          date: e.today,
          status: "Leave",
          reason: "Approved leave",
        })
      ).status,
      200,
    );
    const calendar = (
      await employee(
        `/attendance/monthly?employeeId=emp-2&month=${e.today.slice(0, 7)}`,
      )
    ).body;
    assert.equal(calendar.employeeId, e.user.id);
    const afterLeave = (
      await employee(`/reports/monthly?month=${e.today.slice(0, 7)}`)
    ).body;
    assert.equal(
      afterLeave.calendarRows.find((r: any) => r.date === e.today).status,
      "Leave",
    );
    for (const key of [
      "workingDays",
      "present",
      "absent",
      "late",
      "requiredMinutes",
      "actualMinutes",
      "difference",
      "averageMinutes",
    ]) {
      assert.equal(
        afterLeave[key],
        beforeLeave[key],
        `Report summary ${key} must stay unchanged`,
      );
    }
    assert.ok(calendar.days.length >= 28);
    assert.equal(
      calendar.days.find((d: any) => d.date === e.today).status,
      "Leave",
    );
    assert.equal(
      (
        await admin("/attendance/day-status", "PUT", {
          employeeId: e.user.id,
          date: e.today,
          status: "Automatic",
        })
      ).status,
      200,
    );
    assert.notEqual(
      (
        await employee(`/attendance/monthly?month=${e.today.slice(0, 7)}`)
      ).body.days.find((d: any) => d.date === e.today).status,
      "Leave",
    );
    assert.equal(
      (await admin(`/devices/${requested.id}`, "PATCH", { status: "Revoked" }))
        .status,
      200,
    );
    assert.equal((await outsider("/state")).status, 401);
    assert.equal((await employee("/auth/logout", "POST", {})).status, 200);
    assert.equal((await employee("/state")).status, 401);
    const beforeRestart = (await admin("/state")).body;
    child.kill();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
    child = start();
    child.stdout.on("data", (b) => (logs += b));
    child.stderr.on("data", (b) => (logs += b));
    let restarted = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/api/config`)).ok) {
          restarted = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.ok(restarted, logs);
    const afterRestart = (await admin("/state")).body;
    assert.equal(afterRestart.projects.length, beforeRestart.projects.length);
    assert.deepEqual(afterRestart.workLogs, beforeRestart.workLogs);
    assert.equal(
      afterRestart.tasks.find((t: any) => t.id === created.body.id)
        .elapsedMinutes,
      180,
    );
    assert.equal(
      afterRestart.tasks.find((t: any) => t.id === secondTask.body.id)
        .elapsedMinutes,
      300,
    );
    assert.ok(afterRestart.tasks.every((t: any) => t.startedAt === null));
  } finally {
    child.kill();
    await new Promise<void>((r) => {
      if (child.exitCode !== null) r();
      else child.once("exit", () => r());
    });
    await fs.rm(dir, { recursive: true, force: true });
  }
});
