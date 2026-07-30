import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrackedApp, Settings } from "../types";

const TRACKED_APPS_KEY = "tracked_apps";
const SETTINGS_KEY = "settings";
const ONBOARDING_COMPLETED_KEY = "onboarding_completed";

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const StorageService = {
  async getSettings(): Promise<Settings> {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Error reading settings", e);
    }
    return { themeMode: "system" };
  },

  async saveSettings(settings: Settings): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Error saving settings", e);
    }
  },

  async getTrackedApps(): Promise<TrackedApp[]> {
    try {
      const data = await AsyncStorage.getItem(TRACKED_APPS_KEY);
      if (data) {
        const apps: TrackedApp[] = JSON.parse(data);
        return StorageService.applyMidnightResetIfNeeded(apps);
      }
    } catch (e) {
      console.error("Error reading tracked apps", e);
    }
    return [];
  },

  async saveTrackedApps(apps: TrackedApp[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TRACKED_APPS_KEY, JSON.stringify(apps));
    } catch (e) {
      console.error("Error saving tracked apps", e);
    }
  },

  /**
   * Checks if date has changed (midnight pass).
   * Resets usedTodayMs = 0, isLocked = false, updates lockDate to today.
   * Keeps dailyLimitMs intact.
   */
  async applyMidnightResetIfNeeded(apps: TrackedApp[]): Promise<TrackedApp[]> {
    const today = getTodayDateString();
    let modified = false;

    const updatedApps = apps.map((app) => {
      if (app.lockDate !== today) {
        modified = true;
        return {
          ...app,
          usedTodayMs: 0,
          isLocked: false,
          lockDate: today,
        };
      }
      return app;
    });

    if (modified) {
      await StorageService.saveTrackedApps(updatedApps);
    }
    return updatedApps;
  },

  async addTrackedApp(
    packageName: string,
    appName: string,
    dailyLimitMs: number,
    category?: string,
    iconName?: string,
    iconBase64?: string
  ): Promise<{ success: boolean; error?: string }> {
    const apps = await StorageService.getTrackedApps();
    const today = getTodayDateString();

    const existing = apps.find((a) => a.packageName === packageName);
    if (existing) {
      return {
        success: false,
        error: "This app already has a lock set for today and cannot be modified.",
      };
    }

    const newApp: TrackedApp = {
      packageName,
      appName,
      dailyLimitMs,
      usedTodayMs: 0,
      isLocked: false,
      lockDate: today,
      category,
      iconName,
      iconBase64,
    };

    const updated = [...apps, newApp];
    await StorageService.saveTrackedApps(updated);
    return { success: true };
  },

  async updateAppUsage(packageName: string, usedMs: number): Promise<TrackedApp[]> {
    const apps = await StorageService.getTrackedApps();
    const updated = apps.map((app) => {
      if (app.packageName === packageName) {
        const newUsed = Math.max(app.usedTodayMs, usedMs);
        const shouldLock = newUsed >= app.dailyLimitMs;
        return {
          ...app,
          usedTodayMs: newUsed,
          isLocked: app.isLocked || shouldLock,
        };
      }
      return app;
    });
    await StorageService.saveTrackedApps(updated);
    return updated;
  },

  async isOnboardingCompleted(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return val === "true";
    } catch {
      return false;
    }
  },

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, completed ? "true" : "false");
    } catch (e) {
      console.error("Error saving onboarding state", e);
    }
  },
};
