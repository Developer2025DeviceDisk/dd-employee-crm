import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { all, put } from "../models/store.js";
import { day, at, defaultSettings, late } from "./rules.js";
export async function seed(demo: boolean) {
  if (!(await all("settings")).length) await put("settings", defaultSettings);
  if ((await all("employees")).length) return;
  const password = process.env.ADMIN_PASSWORD || (demo ? "Workpulse@2026" : "");
  if (password.length < 12)
    throw new Error("Set ADMIN_PASSWORD to at least 12 characters");
  await put("employees", {
    id: "admin",
    name: "Alex Morgan",
    email: process.env.ADMIN_EMAIL || "admin@workpulse.local",
    passwordHash: await bcrypt.hash(password, 12),
    employeeId: "WP-000",
    department: "Operations",
    designation: "Workspace administrator",
    phone: "",
    joiningDate: day(),
    role: "admin",
    status: "Active",
    color: "#dfebe5",
  });
  if (!demo) return;
  const hash = await bcrypt.hash("Employee@2026", 12);
  const people = [
    ["Rahul Sharma", "Engineering", "Senior Developer"],
    ["Priya Patel", "Design", "Product Designer"],
    ["Arjun Mehta", "Engineering", "Frontend Developer"],
    ["Sneha Gupta", "Marketing", "Marketing Specialist"],
    ["Vikram Singh", "Engineering", "Backend Developer"],
    ["Ananya Rao", "Design", "UX Researcher"],
    ["Rohan Verma", "Operations", "Operations Analyst"],
    ["Neha Kapoor", "Marketing", "Content Strategist"],
    ["Aditya Joshi", "Engineering", "QA Engineer"],
    ["Isha Desai", "People", "People Partner"],
    ["Karan Shah", "Sales", "Account Executive"],
    ["Meera Nair", "Design", "Visual Designer"],
  ];
  const titles = [
    "CRM API development",
    "Website design system",
    "Employee dashboard",
    "September campaign",
    "Authentication integration",
    "Customer interviews",
    "Monthly operations report",
    "Product launch content",
    "Regression test suite",
    "Employee onboarding",
    "Client proposal",
    "Brand asset library",
  ];
  const colors = [
    "#e0eae2",
    "#efe3d7",
    "#e4e2f2",
    "#f5e0df",
    "#e0e7ee",
    "#ede4d8",
  ];
  const now = new Date(),
    today = day(now);
  for (let i = 0; i < people.length; i++) {
    const [name, department, designation] = people[i],
      id = `emp-${i + 1}`;
    await put("employees", {
      id,
      name,
      email: name.toLowerCase().replace(" ", ".") + "@workpulse.local",
      passwordHash: hash,
      employeeId: `WP-${String(i + 1).padStart(3, "0")}`,
      department,
      designation,
      phone: "",
      joiningDate: "2025-06-02",
      role: "employee",
      status: "Active",
      color: colors[i % colors.length],
    });
    await put("devices", {
      id: `device-${i}`,
      employeeId: id,
      name:
        i % 3 === 0
          ? "Dell Latitude 5440"
          : i % 3 === 1
            ? "MacBook Pro 14”"
            : "ThinkPad X1 Carbon",
      os: i % 3 === 1 ? "macOS" : "Windows 11",
      browser: "Chrome",
      fingerprint: "Demo company asset",
      tokenHash: "unusable-demo-credential",
      status: i === 10 ? "Pending" : "Approved",
      createdAt: at(today, "09:00").toISOString(),
      lastUsed: at(today, "10:00").toISOString(),
    });
    for (let d = 0; d < 28; d++) {
      const date = day(new Date(at(today, "12:00").getTime() - d * 86400000));
      if (
        [0, 6].includes(at(date, "12:00").getUTCDay()) ||
        (i + d) % 17 === 0 ||
        (d === 0 && i > 9)
      )
        continue;
      const minute = i % 4 === 0 ? 23 : i % 3 === 0 ? 12 : 4 + i;
      const login = at(date, `10:${String(minute).padStart(2, "0")}`);
      const end = at(date, "19:00");
      await put("attendance", {
        id: randomUUID(),
        employeeId: id,
        date,
        loginTime: login.toISOString(),
        logoutTime: d > 0 || now > end ? end.toISOString() : null,
        deviceId: `device-${i}`,
        breakMinutes: 0,
        breakStartedAt: null,
        status: late(login, defaultSettings) ? "Late" : "On time",
        autoClosed: d > 0 || now > end,
      });
    }
    const status =
      i === 4
        ? "Blocked"
        : i % 4 === 1
          ? "Completed"
          : i > 9
            ? "Not Started"
            : "In Progress";
    await put("tasks", {
      id: `task-${i}`,
      employeeId: id,
      title: titles[i],
      description:
        "Daily team priorities. Coordinate with the team and share progress before the end of the day.",
      priority: i === 0 || i === 4 ? "High" : "Medium",
      estimatedMinutes: i === 0 ? 180 : 240,
      actualMinutes:
        status === "Completed" ? 215 : status === "Blocked" ? 150 : 0,
      startedAt:
        status === "In Progress"
          ? new Date(
              now.getTime() - (i === 0 ? 225 : 60 + i * 10) * 60000,
            ).toISOString()
          : null,
      completedAt: status === "Completed" ? now.toISOString() : null,
      status,
      date: today,
      comment:
        i === 4
          ? "Waiting for API credentials from the integration partner."
          : "",
      adminComment: "",
    });
  }
  await put("security_events", {
    id: randomUUID(),
    employeeId: "emp-3",
    type: "Unauthorized device",
    title: "Unrecognized device blocked",
    description:
      "Login attempted from an unregistered Android device. No access was granted.",
    createdAt: new Date(now.getTime() - 35 * 60000).toISOString(),
    status: "Open",
    ip: "192.0.2.24",
    device: "Android · Chrome",
  });
}
