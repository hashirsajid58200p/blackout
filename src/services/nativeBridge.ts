import { NativeModules, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

const { BlackoutModule } = NativeModules;

export interface NativePermissionsStatus {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  deviceAdmin: boolean;
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

  syncLockedAppsToNative(lockedAppsJson: string): void {
    if (Platform.OS === "android" && BlackoutModule?.syncLockedAppsToNative) {
      BlackoutModule.syncLockedAppsToNative(lockedAppsJson);
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
    // Dynamic fallback for the last 7 days (today is index 6)
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const fallback = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      fallback.push({
        day: dayNames[d.getDay()],
        dateStr: `${d.getMonth() + 1}/${d.getDate()}`,
        totalUsageMs: 0,
      });
    }
    return fallback;
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
        console.error("BlackoutModule.getInstalledApps returned empty or invalid data");
        return [];
      } catch (error) {
        console.error("Failed to fetch installed apps from native module:", error);
        return [];
      }
    }
    console.error("BlackoutModule.getInstalledApps is not available on this platform");
    return [];
  },
};
