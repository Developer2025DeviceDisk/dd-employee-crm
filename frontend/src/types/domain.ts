// Public API data shapes. No backend runtime code is imported by the frontend.
export type Role = "admin" | "employee";
export interface Employee {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  designation: string;
  phone: string;
  joiningDate: string;
  role: Role;
  status: "Active" | "Inactive";
  color: string;
}
export interface Device {
  id: string;
  employeeId: string;
  name: string;
  os: string;
  browser: string;
  fingerprint: string;
  status: "Pending" | "Approved" | "Rejected" | "Revoked";
  createdAt: string;
  lastUsed: string;
}
export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  loginTime: string;
  logoutTime: string | null;
  deviceId: string;
  breakMinutes: number;
  breakStartedAt: string | null;
  status: "On time" | "Late";
  autoClosed: boolean;
}
export interface Task {
  projectId?: string;
  id: string;
  employeeId: string;
  title: string;
  description: string;
  priority: string;
  estimatedMinutes: number;
  actualMinutes: number;
  startedAt: string | null;
  completedAt: string | null;
  status: "Pending" | "Not Started" | "In Progress" | "Completed" | "Blocked";
  date: string;
  comment: string;
  adminComment: string;
}
export interface Event {
  id: string;
  employeeId: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  status: string;
  ip: string;
  device: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface Settings {
  id: string;
  startTime: string;
  lateThreshold: string;
  endTime: string;
  requiredHours: number;
  breakMinutes: number;
  workingDays: number[];
  holidays: string[];
  alertThreshold: number;
}
export interface DailyReport {
  id: string;
  employeeId: string;
  date: string;
  summary: string;
  blockers: string;
  createdAt: string;
}
export interface Project {
  id: string;
  employeeId: string;
  name: string;
  description: string;
  createdAt: string;
  totalMinutes: number;
  taskCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
}
export interface WorkLog {
  id: string;
  employeeId: string;
  projectId: string;
  taskId: string;
  date: string;
  minutes: number;
  details: string;
  createdAt: string;
  recordedBy: string;
  source: "manual" | "legacy";
}
export interface DailyWork {
  employeeId: string;
  date: string;
  loggedMinutes: number;
  countedMinutes: number;
  requiredMinutes: number;
  remainingMinutes: number;
  status: string;
}
