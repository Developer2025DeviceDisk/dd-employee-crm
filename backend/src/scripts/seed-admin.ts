import "../config/paths.js";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { all, connectStore, get, put } from "../models/store.js";
import { defaultSettings, day } from "../services/rules.js";
import { revokeSessions } from "../middleware/auth.js";

// Explicit provisioning command. Startup never resets existing passwords.
try {
  const email = z.string().email().parse(process.env.ADMIN_EMAIL).toLowerCase();
  const password = z.string().min(12).max(128).parse(process.env.ADMIN_PASSWORD);
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for admin provisioning.");
  await connectStore();
  const existing = (await all("employees")).find((e) => e.email === email);
  if (existing && existing.role !== "admin") throw new Error("This email belongs to a non-admin account; no changes made.");
  const passwordHash = await bcrypt.hash(password, 12);
  const id = existing?.id || randomUUID();
  await put("employees", {
    ...(existing || {
      id,
      name: "DeviceDisk Admin",
      employeeId: `ADMIN-${id.slice(0, 8).toUpperCase()}`,
      department: "Administration",
      designation: "Workspace administrator",
      phone: "",
      joiningDate: day(),
      color: "#dfebe5",
    }),
    email,
    passwordHash,
    role: "admin",
    status: "Active",
  });
  if (existing) await revokeSessions(id);
  if (!(await get("settings", "company"))) await put("settings", defaultSettings);
  const saved = await get("employees", id);
  if (!saved || !(await bcrypt.compare(password, saved.passwordHash))) throw new Error("Admin verification failed.");
  console.log(JSON.stringify({success:true, email, database:mongoose.connection.name, action:existing?'updated':'created', passwordVerified:true}));
} catch (error) {
  console.error("Admin provisioning failed:", error instanceof Error ? error.name : "Unknown error");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
