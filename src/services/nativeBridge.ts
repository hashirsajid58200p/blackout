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

  async getTodayUsage(packageName: string): Promise<number> {
    if (Platform.OS === "android" && BlackoutModule?.getTodayUsage) {
      try {
        return await BlackoutModule.getTodayUsage(packageName);
      } catch {
        return 0;
      }
    }
    return 0;
  },

  async getInstalledApps(): Promise<Array<{ packageName: string; appName: string; category?: string }>> {
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
