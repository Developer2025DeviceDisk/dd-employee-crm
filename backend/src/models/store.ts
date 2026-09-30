import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import type { Tables } from "./types.js";
import { backendRoot } from "../config/paths.js";
type Key = keyof Tables;
const keys: Key[] = [
  "projects",
  "work_logs",
  "attendance_adjustments",
  "employees",
  "devices",
  "attendance",
  "tasks",
  "notifications",
  "security_events",
  "audit_logs",
  "sessions",
  "settings",
  "daily_reports",
];
const file = path.resolve(
  backendRoot,
  process.env.DATA_FILE || "data/workpulse.json",
);
let local: Record<string, any[]> = Object.fromEntries(keys.map((k) => [k, []]));
const models: Record<string, mongoose.Model<any>> = {};
let queue = Promise.resolve();
export async function connectStore() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    for (const k of keys) {
      const schema = new mongoose.Schema(
        {
          id: { type: String, required: true, unique: true },
          employeeId: { type: String, index: true },
          date: { type: String, index: true },
          email: String,
          status: { type: String, index: true },
          createdAt: { type: String, index: true },
          tokenHash: String,
        },
        { strict: false, versionKey: false },
      );
      if (k === "employees") schema.index({ email: 1 }, { unique: true });
      if (k === "attendance")
        schema.index({ employeeId: 1, date: 1 }, { unique: true });
      if (k === "sessions") schema.index({ tokenHash: 1 }, { unique: true });
      models[k] = mongoose.model(k, schema);
      await models[k].init();
    }
  } else {
    await fs.mkdir(path.dirname(file), { recursive: true });
    try {
      local = { ...local, ...JSON.parse(await fs.readFile(file, "utf8")) };
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  }
}
async function flush() {
  queue = queue.then(async () => {
    const temp = file + ".tmp";
    await fs.writeFile(temp, JSON.stringify(local, null, 2));
    await fs.rename(temp, file);
  });
  await queue;
}
export async function all<K extends Key>(key: K): Promise<Tables[K][]> {
  return models[key]
    ? ((await models[key]
        .find({}, { _id: 0 })
        .lean()) as unknown as Tables[K][])
    : structuredClone(local[key]);
}
export async function put<K extends Key>(
  key: K,
  value: Tables[K],
): Promise<Tables[K]> {
  if (models[key])
    await models[key].replaceOne({ id: value.id }, value, { upsert: true });
  else {
    const i = local[key].findIndex((v) => v.id === value.id);
    if (i < 0) local[key].push(structuredClone(value));
    else local[key][i] = structuredClone(value);
    await flush();
  }
  return value;
}
export async function remove<K extends Key>(key: K, id: string) {
  if (models[key]) await models[key].deleteOne({ id });
  else {
    local[key] = local[key].filter((v) => v.id !== id);
    await flush();
  }
}
export async function get<K extends Key>(key: K, id: string) {
  return (await all(key)).find((x) => x.id === id);
}
