import { NativeModules, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

const { BlackoutModule } = NativeModules;

export interface NativePermissionsStatus {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
}

export const NativeBridge = {
  async isDeviceAdminActive(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.isDeviceAdminActive) {
      try {
        return await BlackoutModule.isDeviceAdminActive();
      } catch {
        return false;
      }
    }
    return false;
  },

  async requestDeviceAdmin(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.requestDeviceAdmin) {
      try {
        return await BlackoutModule.requestDeviceAdmin();
      } catch {
        return false;
      }
    }
    return false;
  },

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
        if (Array.isArray(stats)) {
          return stats;
        }
      } catch {
        // fallback
      }
    }
    // Fallback if not on Android or native module unavailable
    return [
      { day: "SUN", dateStr: "Oct 25", totalUsageMs: 0 },
      { day: "MON", dateStr: "Oct 26", totalUsageMs: 0 },
      { day: "TUE", dateStr: "Oct 27", totalUsageMs: 0 },
      { day: "WED", dateStr: "Oct 28", totalUsageMs: 0 },
      { day: "THU", dateStr: "Oct 29", totalUsageMs: 0 },
      { day: "FRI", dateStr: "Oct 30", totalUsageMs: 0 },
      { day: "SAT", dateStr: "Oct 31", totalUsageMs: 0 },
    ];
  },

  async getDayUsageStats(dayOffset: number): Promise<Array<{ packageName: string; appName: string; usedMs: number; openCount?: number }>> {
    if (Platform.OS === "android" && BlackoutModule?.getDayUsageStats) {
      try {
        const stats = await BlackoutModule.getDayUsageStats(dayOffset);
        if (Array.isArray(stats)) {
          return stats;
        }
      } catch {
        // fallback
      }
    }
    return [];
  },

  async uninstallPackage(packageName: string): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.uninstallPackage) {
      try {
        return await BlackoutModule.uninstallPackage(packageName);
      } catch {
        return false;
      }
    }
    return false;
  },

  async getInstalledApps(): Promise<Array<{ packageName: string; appName: string; category?: string; iconBase64?: string; usedTodayMs?: number }>> {
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
