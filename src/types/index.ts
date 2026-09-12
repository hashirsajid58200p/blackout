export interface TrackedApp {
  packageName: string;
  appName: string;
  dailyLimitMs: number; // Set once per day, immutable after set
  usedTodayMs: number;
  isLocked: boolean;
  lockDate: string; // "YYYY-MM-DD" — the day this lock applies to
  category?: string;
  initialUsageMs?: number; // Device usage baseline at moment timer was configured
  lockExpirationTimestamp?: number; // Milliseconds epoch for 12:00 AM next day
  lockedAtTimestamp?: number; // Milliseconds epoch when app transitioned to locked
  iconName?: string;
  iconBase64?: string;
  iconUri?: string;
}

export interface DowntimeConfig {
  enabled: boolean;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
  activeDays: "everyday" | "weekdays" | "weekends";
}

export interface Settings {
  themeMode: "system" | "light" | "dark"; // default: "system"
  autoCleanUninstalled?: boolean; // default: true
  warningNotifications?: boolean; // default: true (5m remaining alert)
  lockoutNotifications?: boolean; // default: true (when app locks)
  midnightResetNotifications?: boolean; // default: true (12:00 AM reset summary)
  statusBarNotification?: boolean; // default: true (ongoing status bar indicator)
  hapticFeedback?: boolean; // default: true (tactile mechanical clicks & stamp thuds)
  downtime?: DowntimeConfig; // Scheduled Downtime ("Night Watch")
}

export interface SystemDiagnostics {
  isAccessibilityActive: boolean;
  isBatteryIgnored: boolean;
  isNotificationGranted: boolean;
  isDeviceAdminActive: boolean;
  nextMidnightTimestamp: number;
  downtimeActive?: boolean;
  downtimeWindow?: string;
}

export interface InstalledAppInfo {
  packageName: string;
  appName: string;
  iconName?: string;
  category?: string;
  iconBase64?: string;
  iconUri?: string;
  usedTodayMs?: number;
}

export interface WeeklyStats {
  day: string; // "Mon", "Tue", etc.
  dateStr: string;
  totalUsageMs: number;
}
