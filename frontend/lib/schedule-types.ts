export type ScheduleEntryType = "setpoint" | "continuation";
export type ScheduleMode = "HEAT" | "COOL" | "RANGE" | "OFF";

export interface ScheduleEntry {
  entry_type: ScheduleEntryType;
  temp: number;
  time: number;
  touched_at: number;
  touched_by: number;
  touched_tzo: number;
  type: ScheduleMode;
}

export interface DaySchedule {
  [key: string]: ScheduleEntry;
}

export interface WeekSchedule {
  days: {
    "0": DaySchedule;
    "1": DaySchedule;
    "2": DaySchedule;
    "3": DaySchedule;
    "4": DaySchedule;
    "5": DaySchedule;
    "6": DaySchedule;
  };
  name: string;
  schedule_mode: ScheduleMode;
  ver: number;
}

export interface ScheduleResponse {
  serial: string;
  object_key: string;
  object_revision: number;
  object_timestamp: number;
  value: WeekSchedule;
  updatedAt: number;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTimeLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);

  if (hours === 0) return "12A";
  if (hours < 12) return `${hours}A`;
  if (hours === 12) return "12P";
  return `${hours - 12}P`;
}

export function getTimePosition(seconds: number): number {
  return (seconds / 86400) * 100;
}

export function celsiusToFahrenheit(celsius: number): number {
  return Math.round(celsius * 9 / 5 + 32);
}

export function parseScheduleEntries(daySchedule: DaySchedule): ScheduleEntry[] {
  return Object.values(daySchedule)
    .filter((entry): entry is ScheduleEntry => entry !== null && entry !== undefined)
    .sort((a, b) => a.time - b.time);
}
