import { NativeModules, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

const { BlackoutModule } = NativeModules;

export interface NativePermissionsStatus {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  deviceAdmin: boolean;
  notifications: boolean;
  batteryOptimization: boolean;
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
    return Platform.OS !== "android";
  },

  async requestDeviceAdmin(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.requestDeviceAdmin) {
      try {
        return await BlackoutModule.requestDeviceAdmin();
      } catch {
        return false;
      }
    }
    return true;
  },

  async checkUsageStatsPermission(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.hasUsageStatsPermission) {
      try {
        return await BlackoutModule.hasUsageStatsPermission();
      } catch {
        return false;
      }
    }
    return Platform.OS !== "android";
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
    return Platform.OS !== "android";
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
    return Platform.OS !== "android";
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

  async getDayUsageStats(dayOffset: number): Promise<Array<{ packageName: string; appName: string; usedMs: number; openCount?: number; iconBase64?: string; iconUri?: string }>> {
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
    if (Platform.OS !== "android") {
      return [
        { packageName: "com.whatsapp", appName: "WhatsApp", usedMs: 3600000 },
        { packageName: "com.instagram.android", appName: "Instagram", usedMs: 5400000 },
        { packageName: "com.google.android.youtube", appName: "YouTube", usedMs: 7200000 },
      ];
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

  async unlockPackage(packageName: string): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.unlockPackage) {
      try {
        return await BlackoutModule.unlockPackage(packageName);
      } catch (error) {
        console.error("NativeBridge.unlockPackage error:", error);
        return false;
      }
    }
    return true;
  },

  async getInstalledApps(): Promise<Array<{ packageName: string; appName: string; category?: string; iconBase64?: string; iconUri?: string; usedTodayMs?: number }>> {
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
    if (Platform.OS !== "android") {
      return [
        { packageName: "com.whatsapp", appName: "WhatsApp", usedTodayMs: 3600000 },
        { packageName: "com.instagram.android", appName: "Instagram", usedTodayMs: 5400000 },
        { packageName: "com.google.android.youtube", appName: "YouTube", usedTodayMs: 7200000 },
        { packageName: "com.twitter.android", appName: "X", usedTodayMs: 1800000 },
        { packageName: "com.android.chrome", appName: "Chrome", usedTodayMs: 2400000 },
      ];
    }
    console.error("BlackoutModule.getInstalledApps is not available on this platform");
    return [];
  },

  async hasNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.hasNotificationPermission) {
      try {
        return await BlackoutModule.hasNotificationPermission();
      } catch {
        return false;
      }
    }
    return true;
  },

  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.requestNotificationPermission) {
      try {
        return await BlackoutModule.requestNotificationPermission();
      } catch {
        return false;
      }
    }
    return true;
  },

  async isBatteryOptimizationIgnored(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.isBatteryOptimizationIgnored) {
      try {
        return await BlackoutModule.isBatteryOptimizationIgnored();
      } catch {
        return false;
      }
    }
    return true;
  },

  async requestIgnoreBatteryOptimization(): Promise<boolean> {
    if (Platform.OS === "android" && BlackoutModule?.requestIgnoreBatteryOptimization) {
      try {
        return await BlackoutModule.requestIgnoreBatteryOptimization();
      } catch {
        return false;
      }
    }
    return true;
  },

  syncNotificationSettings(warningsEnabled: boolean, locksEnabled: boolean, resetEnabled: boolean): void {
    if (Platform.OS === "android" && BlackoutModule?.syncNotificationSettings) {
      try {
        BlackoutModule.syncNotificationSettings(warningsEnabled, locksEnabled, resetEnabled);
      } catch (e) {
        console.warn("Failed to syncNotificationSettings", e);
      }
    }
  },

  syncDowntimeSettings(downtime?: {
    enabled: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    activeDays: string;
  }): void {
    if (Platform.OS === "android" && BlackoutModule?.syncDowntimeSettings) {
      try {
        if (!downtime) {
          BlackoutModule.syncDowntimeSettings(false, 22, 0, 6, 0, "everyday");
        } else {
          BlackoutModule.syncDowntimeSettings(
            downtime.enabled,
            downtime.startHour,
            downtime.startMinute,
            downtime.endHour,
            downtime.endMinute,
            downtime.activeDays
          );
        }
      } catch (e) {
        console.warn("Failed to syncDowntimeSettings", e);
      }
    }
  },

  syncHapticSetting(enabled: boolean): void {
    if (Platform.OS === "android" && BlackoutModule?.syncHapticSetting) {
      try {
        BlackoutModule.syncHapticSetting(enabled);
      } catch (e) {
        console.warn("Failed to syncHapticSetting", e);
      }
    }
  },

  triggerHaptic(type: "tick" | "stamp" | "strike" | "heavy"): void {
    if (Platform.OS === "android" && BlackoutModule?.triggerHaptic) {
      try {
        BlackoutModule.triggerHaptic(type);
      } catch (e) {
        console.warn("Failed to triggerHaptic", e);
      }
    }
  },

  async rearmDiagnostics(): Promise<{
    isAccessibilityActive: boolean;
    isBatteryIgnored: boolean;
    isNotificationGranted: boolean;
    isDeviceAdminActive: boolean;
    nextMidnightTimestamp: number;
  }> {
    if (Platform.OS === "android" && BlackoutModule?.rearmDiagnostics) {
      try {
        return await BlackoutModule.rearmDiagnostics();
      } catch (e) {
        console.warn("rearmDiagnostics failed", e);
      }
    }
    return this.getDiagnostics();
  },

  async getDiagnostics(): Promise<{
    isAccessibilityActive: boolean;
    isBatteryIgnored: boolean;
    isNotificationGranted: boolean;
    isDeviceAdminActive: boolean;
    nextMidnightTimestamp: number;
  }> {
    if (Platform.OS === "android" && BlackoutModule?.getDiagnostics) {
      try {
        return await BlackoutModule.getDiagnostics();
      } catch (e) {
        console.warn("getDiagnostics failed", e);
      }
    }
    return {
      isAccessibilityActive: true,
      isBatteryIgnored: true,
      isNotificationGranted: true,
      isDeviceAdminActive: true,
      nextMidnightTimestamp: Date.now() + 3600000,
    };
  },
};
