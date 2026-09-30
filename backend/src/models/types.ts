export type Role = "admin" | "employee";
export interface Employee {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
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
  tokenHash: string;
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
  id: string;
  employeeId: string;
  title: string;
  description: string;
  priority: string;
  estimatedMinutes: number;
  actualMinutes: number;
  startedAt: string | null;
  completedAt: string | null;
  status: "Not Started" | "In Progress" | "Completed" | "Blocked";
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
export interface Session {
  id: string;
  tokenHash: string;
  previousHash?: string;
  employeeId: string;
  deviceId: string;
  expiresAt: string;
  rotatedAt: string;
  csrf: string;
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
export interface Tables {
  attendance_adjustments: AttendanceAdjustment;
  employees: Employee;
  devices: Device;
  attendance: Attendance;
  tasks: Task;
  notifications: Event;
  security_events: Event;
  audit_logs: Event;
  sessions: Session;
  settings: Settings;
  daily_reports: DailyReport;
}
export interface AttendanceAdjustment {
  id: string;
  employeeId: string;
  date: string;
  status: "Leave" | "Half Day";
  reason: string;
  recordedBy: string;
  createdAt: string;
}
