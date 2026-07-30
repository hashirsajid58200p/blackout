import { NativeModules, Platform } from "react-native";

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
    return true; // Fallback for dev/mock
  },

  openUsageStatsSettings(): void {
    if (Platform.OS === "android" && BlackoutModule?.openUsageStatsSettings) {
      BlackoutModule.openUsageStatsSettings();
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
    return true;
  },

  openOverlaySettings(): void {
    if (Platform.OS === "android" && BlackoutModule?.openOverlaySettings) {
      BlackoutModule.openOverlaySettings();
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
    return true;
  },

  openAccessibilitySettings(): void {
    if (Platform.OS === "android" && BlackoutModule?.openAccessibilitySettings) {
      BlackoutModule.openAccessibilitySettings();
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
};
