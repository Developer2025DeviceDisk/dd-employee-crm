import type {
  Employee,
  Attendance,
  Task,
  Device,
  Event,
  Settings,
  DailyReport,
} from "../types/domain";
export type Person = Employee;
export type Entry = Attendance & {
  effectiveMinutes: number;
  difference: number;
  requiredMinutes: number;
  sessionMinutes: number;
};
export type Work = Task & { elapsedMinutes: number; isOverdue: boolean };
export interface State {
  user: Person;
  employees: Person[];
  attendance: Entry[];
  tasks: Work[];
  devices: Device[];
  notifications: Event[];
  security: Event[];
  audit: Event[];
  reports: DailyReport[];
  settings: Settings;
  today: string;
  serverTime: string;
  demo: boolean;
  csrf: string;
}
let csrf = "";
const backendOrigin =
  import.meta.env.VITE_API_URL?.trim() ||
  "https://dd-employee-crm.onrender.com";
const apiBase =
  backendOrigin.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(apiBase + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: data === undefined ? undefined : JSON.stringify(data),
  }).catch(() => {
    throw new Error(
      "Cannot reach the backend. Wait for the API startup message and try again.",
    );
  });
  const result = await response
    .json()
    .catch(() => ({ error: "The server could not complete this request." }));
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Request failed"), {
      status: response.status,
      deviceRequired: result.deviceRequired,
      deviceStatus: result.deviceStatus,
    });
  if (result.csrf) csrf = result.csrf;
  return result;
}
export function duration(minutes: number) {
  const n = Math.max(0, Math.round(minutes));
  return `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m`;
}
export function isWeekend(date: string) {
  return [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
}
export function time(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";
}
export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}
export function download(name: string, rows: unknown[][]) {
  const csv = rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@-]/, "'")
              .replace(/"/g, '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
