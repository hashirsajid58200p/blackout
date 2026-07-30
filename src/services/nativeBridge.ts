import { NativeModules, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

const { BlackoutModule } = NativeModules;

export interface NativePermissionsStatus {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
}

export const NativeBridge = {
  async checkUsageStatsPermission(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.hasUsageStatsPermission) {
      try {
        return await BlackoutModule.hasUsageStatsPermission();
      } catch {
        return false;
      }
    }
    return false;
  },

  openUsageStatsSettings(): void {
    if (Platform.OS === "android") {
      if (BlackoutModule?.openUsageStatsSettings) {
        BlackoutModule.openUsageStatsSettings();
      } else {
        IntentLauncher.startActivityAsync("android.settings.USAGE_ACCESS_SETTINGS").catch(() => {});
      }
    }
  },

  async checkOverlayPermission(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.hasOverlayPermission) {
      try {
        return await BlackoutModule.hasOverlayPermission();
      } catch {
        return false;
      }
    }
    return false;
  },

  openOverlaySettings(): void {
    if (Platform.OS === "android") {
      if (BlackoutModule?.openOverlaySettings) {
        BlackoutModule.openOverlaySettings();
      } else {
        IntentLauncher.startActivityAsync("android.settings.action.MANAGE_OVERLAY_PERMISSION").catch(() => {});
      }
    }
  },

  async checkAccessibilityPermission(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.hasAccessibilityPermission) {
      try {
        return await BlackoutModule.hasAccessibilityPermission();
      } catch {
        return false;
      }
    }
    return false;
  },

  openAccessibilitySettings(): void {
    if (Platform.OS === "android") {
      if (BlackoutModule?.openAccessibilitySettings) {
        BlackoutModule.openAccessibilitySettings();
      } else {
        IntentLauncher.startActivityAsync("android.settings.ACCESSIBILITY_SETTINGS").catch(() => {});
      }
    }
  },

  syncLockedPackages(packageNames: string[]): void {
    if (Platform.OS === "android" && BlackoutModule?.setLockedPackages) {
      BlackoutModule.setLockedPackages(packageNames);
    }
  },

  async getTodayUsageStats(packageName: string): Promise<number> {
    if (Platform.OS === "android" && BlackoutModule?.getTodayUsage) {
      try {
        return await BlackoutModule.getTodayUsage(packageName);
      } catch {
        return 0;
      }
    }
    return 0;
  },

  async getWeeklyUsageStats(): Promise<Array<{ day: string; dateStr: string; totalUsageMs: number }>> {
    if (Platform.OS === "android" && BlackoutModule?.getWeeklyUsageStats) {
      try {
        const stats = await BlackoutModule.getWeeklyUsageStats();
        if (Array.isArray(stats) && stats.length > 0 && stats.some((s) => s.totalUsageMs > 0)) {
          return stats;
        }
      } catch {
        // fallback
      }
    }
    // Rich Demo Fallback for 7-Day Chart
    return [
      { day: "SUN", dateStr: "Oct 25", totalUsageMs: 3.5 * 3600 * 1000 },
      { day: "MON", dateStr: "Oct 26", totalUsageMs: 5.2 * 3600 * 1000 },
      { day: "TUE", dateStr: "Oct 27", totalUsageMs: 4.1 * 3600 * 1000 },
      { day: "WED", dateStr: "Oct 28", totalUsageMs: 6.0 * 3600 * 1000 },
      { day: "THU", dateStr: "Oct 29", totalUsageMs: 3.8 * 3600 * 1000 },
      { day: "FRI", dateStr: "Oct 30", totalUsageMs: 4.8 * 3600 * 1000 },
      { day: "SAT", dateStr: "Oct 31", totalUsageMs: 5.05 * 3600 * 1000 },
    ];
  },

  async getDayUsageStats(dayOffset: number): Promise<Array<{ packageName: string; appName: string; usedMs: number }>> {
    if (Platform.OS === "android" && BlackoutModule?.getDayUsageStats) {
      try {
        const stats = await BlackoutModule.getDayUsageStats(dayOffset);
        if (Array.isArray(stats) && stats.length > 0 && stats.some((s) => s.usedMs > 0)) {
          return stats;
        }
      } catch {
        // fallback
      }
    }
    // Rich Demo Fallback for Day Breakdown (Most used app at top)
    const factor = Math.max(0.4, 1 - Math.abs(dayOffset) * 0.08);
    return [
      { packageName: "com.google.android.youtube", appName: "YOUTUBE", usedMs: Math.round(2.25 * 3600 * 1000 * factor) },
      { packageName: "com.instagram.android", appName: "INSTAGRAM", usedMs: Math.round(1.75 * 3600 * 1000 * factor) },
      { packageName: "com.zhiliaoapp.musically", appName: "TIKTOK", usedMs: Math.round(0.75 * 3600 * 1000 * factor) },
      { packageName: "com.whatsapp", appName: "WHATSAPP", usedMs: Math.round(0.33 * 3600 * 1000 * factor) },
    ];
  },

  async getInstalledApps(): Promise<Array<{ packageName: string; appName: string; category?: string; iconBase64?: string }>> {
    if (Platform.OS === "android" && BlackoutModule?.getInstalledApps) {
      try {
        const apps = await BlackoutModule.getInstalledApps();
        if (Array.isArray(apps) && apps.length > 0) {
          return apps.sort((a, b) => a.appName.localeCompare(b.appName));
        }
      } catch {
        // Fallback to default list
      }
    }
    return DEFAULT_APPS;
  },
};

const DEFAULT_APPS: Array<{ packageName: string; appName: string; category?: string }> = [
  { packageName: "com.instagram.android", appName: "Instagram", category: "Social" },
  { packageName: "com.google.android.youtube", appName: "YouTube", category: "Media & Video" },
  { packageName: "com.zhiliaoapp.musically", appName: "TikTok", category: "Social & Short Video" },
  { packageName: "com.whatsapp", appName: "WhatsApp", category: "Messaging" },
  { packageName: "com.facebook.katana", appName: "Facebook", category: "Social" },
  { packageName: "com.facebook.orca", appName: "Messenger", category: "Messaging" },
  { packageName: "com.snapchat.android", appName: "Snapchat", category: "Social" },
  { packageName: "com.twitter.android", appName: "X / Twitter", category: "Social" },
  { packageName: "com.reddit.frontpage", appName: "Reddit", category: "News & Community" },
  { packageName: "com.android.chrome", appName: "Google Chrome", category: "Browser" },
  { packageName: "com.netflix.mediaclient", appName: "Netflix", category: "Entertainment" },
  { packageName: "com.spotify.music", appName: "Spotify", category: "Music & Audio" },
  { packageName: "org.telegram.messenger", appName: "Telegram", category: "Messaging" },
  { packageName: "com.pinterest", appName: "Pinterest", category: "Social & Lifestyle" },
  { packageName: "com.linkedin.android", appName: "LinkedIn", category: "Professional" },
  { packageName: "com.discord", appName: "Discord", category: "Gaming & Chat" },
  { packageName: "com.tencent.ig", appName: "PUBG Mobile", category: "Gaming" },
  { packageName: "com.dts.freefireth", appName: "Free Fire", category: "Gaming" },
  { packageName: "com.roblox.client", appName: "Roblox", category: "Gaming" },
  { packageName: "com.kiloo.subwaysurfers", appName: "Subway Surfers", category: "Gaming" },
];
