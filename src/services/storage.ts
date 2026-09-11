import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrackedApp, Settings } from "../types";
import { NativeBridge } from "./nativeBridge";

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

export const getNextMidnightTimestamp = (): number => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const StorageService = {
  getNextMidnightTimestamp,

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
        return await StorageService.applyMidnightResetIfNeeded(apps);
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
          initialUsageMs: 0,
          isLocked: false,
          lockDate: today,
          lockExpirationTimestamp: 0,
          lockedAtTimestamp: undefined,
        };
      }
      return app;
    });

    if (modified) {
      await StorageService.saveTrackedApps(updatedApps);
    }
    return updatedApps;
  },

  /**
   * Compares stored locked apps against installed app package names.
   * If a locked app is no longer installed, removes it from AsyncStorage.
   */
  async cleanUninstalledTrackedApps(installedPackageNames: string[]): Promise<TrackedApp[]> {
    const apps = await StorageService.getTrackedApps();
    const installedSet = new Set(installedPackageNames);

    const validApps = apps.filter(
      (app) => app.packageName.startsWith("custom.") || installedSet.has(app.packageName)
    );

    if (validApps.length !== apps.length) {
      await StorageService.saveTrackedApps(validApps);
    }
    return validApps;
  },

  async addTrackedApp(
    packageName: string,
    appName: string,
    dailyLimitMs: number,
    category?: string,
    iconName?: string,
    iconBase64?: string,
    iconUri?: string
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

    let initialUsage = 0;
    if (!packageName.startsWith("custom.")) {
      try {
        initialUsage = await NativeBridge.getTodayUsageStats(packageName);
      } catch {
        initialUsage = 0;
      }
    }

    const nextMidnight = getNextMidnightTimestamp();

    // App begins in MONITORED / TIMER RUNNING state. Elapsed usage starts at 0.
    const newApp: TrackedApp = {
      packageName,
      appName,
      dailyLimitMs,
      usedTodayMs: 0,
      initialUsageMs: initialUsage,
      isLocked: false,
      lockDate: today,
      lockExpirationTimestamp: nextMidnight,
      category,
      iconName,
      iconBase64,
      iconUri,
    };

    const updated = [...apps, newApp];
    await StorageService.saveTrackedApps(updated);
    return { success: true };
  },

  async updateAppUsage(packageName: string, currentDeviceUsageMs: number): Promise<TrackedApp[]> {
    const apps = await StorageService.getTrackedApps();
    const updated = apps.map((app) => {
      if (app.packageName === packageName) {
        const initial = app.initialUsageMs || 0;
        const elapsed = Math.max(0, currentDeviceUsageMs - initial);
        const shouldLock = app.dailyLimitMs > 0 && elapsed >= app.dailyLimitMs;
        const lockChanged = !app.isLocked && shouldLock;
        return {
          ...app,
          usedTodayMs: elapsed,
          isLocked: app.isLocked || shouldLock,
          lockedAtTimestamp: lockChanged ? Date.now() : app.lockedAtTimestamp,
          lockExpirationTimestamp: app.lockExpirationTimestamp || getNextMidnightTimestamp(),
        };
      }
      return app;
    });
    await StorageService.saveTrackedApps(updated);
    return updated;
  },

  async unlockTrackedApp(packageName: string): Promise<{ success: boolean; error?: string }> {
    const apps = await StorageService.getTrackedApps();
    const app = apps.find((a) => a.packageName === packageName);
    if (!app) {
      return { success: true };
    }

    const now = Date.now();
    const expiration = app.lockExpirationTimestamp || getNextMidnightTimestamp();
    // Strict verification: locked apps cannot be unlocked before the lock period expires
    if (app.isLocked && now < expiration) {
      return {
        success: false,
        error: "This application is locked and cannot be unlocked until midnight in accordance with Blackout rules.",
      };
    }

    // Call native unlock to verify against native source of truth
    try {
      const nativeOk = await NativeBridge.unlockPackage(packageName);
      if (!nativeOk) {
        return {
          success: false,
          error: "Native security policy prevented unlocking before expiration.",
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Cannot unlock before lock period completes.",
      };
    }

    // Remove from tracked_apps and sync across systems
    const updated = apps.filter((a) => a.packageName !== packageName);
    await StorageService.saveTrackedApps(updated);
    NativeBridge.syncLockedAppsToNative(JSON.stringify(updated));
    const lockedPkgs = updated.filter((a) => a.isLocked).map((a) => a.packageName);
    NativeBridge.syncLockedPackages(lockedPkgs);

    return { success: true };
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
