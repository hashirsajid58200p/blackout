export interface TrackedApp {
  packageName: string;
  appName: string;
  dailyLimitMs: number; // Set once per day, immutable after set
  usedTodayMs: number;
  isLocked: boolean;
  lockDate: string; // "YYYY-MM-DD" — the day this lock applies to
  category?: string;
  iconName?: string;
}

export interface Settings {
  themeMode: "system" | "light" | "dark"; // default: "system"
}

export interface InstalledAppInfo {
  packageName: string;
  appName: string;
  iconName?: string;
  category?: string;
}

export interface WeeklyStats {
  day: string; // "Mon", "Tue", etc.
  dateStr: string;
  totalUsageMs: number;
}
