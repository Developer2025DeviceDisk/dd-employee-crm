import { all, get, put } from "../models/store.js";
import type { Settings, WorkLog } from "../models/types.js";
import { at, isWeekend } from "./rules.js";

// Run before accepting requests. Deterministic IDs make interrupted migrations safe to retry.
// Only previously saved time is imported; an abandoned timer must not accrue downtime.
export async function migrateTaskLogs() {
  for (const task of await all("tasks")) {
    if (task.projectId) continue;
    const projectId = `legacy-project-${task.employeeId}`;
    if (!(await get("projects", projectId)))
      await put("projects", {
        id: projectId,
        employeeId: task.employeeId,
        name: "Existing work",
        description: "Tasks created before project-based work logging.",
        createdAt: new Date().toISOString(),
      });
    if (task.actualMinutes > 0)
      await put("work_logs", {
        id: `legacy-log-${task.id}`,
        projectId,
        employeeId: task.employeeId,
        taskId: task.id,
        date: task.date,
        minutes: Math.floor(task.actualMinutes),
        details:
          "Imported saved task time; original daily breakdown unavailable.",
        source: "legacy",
        recordedBy: task.employeeId,
        createdAt: new Date().toISOString(),
      });
    await put("tasks", {
      ...task,
      projectId,
      startedAt: null,
      status: task.status === "Not Started" ? "Pending" : task.status,
    });
  }
}

export function dailyWork(
  employeeId: string,
  date: string,
  logs: WorkLog[],
  settings: Settings,
) {
  const off =
    isWeekend(date) ||
    settings.holidays.includes(date) ||
    !settings.workingDays.includes(at(date, "12:00").getUTCDay());
  const loggedMinutes = logs
    .filter((l) => l.employeeId === employeeId && l.date === date)
    .reduce((sum, l) => sum + l.minutes, 0);
  const requiredMinutes = off ? 0 : 480;
  return {
    employeeId,
    date,
    loggedMinutes,
    countedMinutes: off ? 0 : loggedMinutes,
    requiredMinutes,
    remainingMinutes: Math.max(0, requiredMinutes - loggedMinutes),
    status: off ? "Day off" : loggedMinutes >= 480 ? "Completed" : "Incomplete",
  };
}
