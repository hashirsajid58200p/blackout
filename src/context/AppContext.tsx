import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useColorScheme as useRNColorScheme, Appearance, AppState, NativeEventEmitter, Platform } from "react-native";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { TrackedApp, Settings, WeeklyStats } from "../types";
import { StorageService } from "../services/storage";
import { NativeBridge, NativePermissionsStatus } from "../services/nativeBridge";

type ScreenType =
  | "onboarding"
  | "permissions"
  | "home"
  | "add_app"
  | "blackout"
  | "stats"
  | "settings";

export interface DeviceAppUsage {
  packageName: string;
  appName: string;
  usedMs: number;
  openCount?: number;
  iconBase64?: string;
  iconUri?: string;
}

interface AppContextType {
  currentScreen: ScreenType;
  setCurrentScreen: (screen: ScreenType) => void;
  trackedApps: TrackedApp[];
  settings: Settings;
  permissions: NativePermissionsStatus;
  refreshPermissions: () => Promise<boolean>;
  updateThemeMode: (mode: "system" | "light" | "dark") => Promise<void>;
  updateAutoCleanSetting: (enabled: boolean) => Promise<void>;
  addTrackedApp: (
    packageName: string,
    appName: string,
    dailyLimitMs: number,
    category?: string,
    iconName?: string,
    iconBase64?: string,
    iconUri?: string
  ) => Promise<{ success: boolean; error?: string }>;
  activeBlockApp: TrackedApp | null;
  setActiveBlockApp: (app: TrackedApp | null) => void;
  colorScheme: "light" | "dark";
  effectiveTheme: "light" | "dark";
  refreshData: () => Promise<void>;
  todayDeviceUsage: DeviceAppUsage[];
  todayTotalUsageMs: number;
  weeklyUsageStats: WeeklyStats[];
  refreshUsageStats: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setColorScheme } = useNativeWindColorScheme();
  const rnColorScheme = useRNColorScheme();

  // ── State declarations ───────────────────────────────────────────────────────
  const [sysScheme, setSysScheme] = useState<"light" | "dark">(
    rnColorScheme === "dark" ? "dark" : Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [trackedApps, setTrackedApps] = useState<TrackedApp[]>([]);
  const [settings, setSettings] = useState<Settings>({ themeMode: "system", autoCleanUninstalled: true });
  const [permissions, setPermissions] = useState<NativePermissionsStatus>({
    usageStats: false,
    overlay: false,
    accessibility: false,
    deviceAdmin: false,
  });
  const [activeBlockApp, setActiveBlockApp] = useState<TrackedApp | null>(null);

  // Synchronized real device screen time state (consumed by HomeScreen & StatsScreen)
  const [todayDeviceUsage, setTodayDeviceUsage] = useState<DeviceAppUsage[]>([]);
  const [todayTotalUsageMs, setTodayTotalUsageMs] = useState<number>(0);
  const [weeklyUsageStats, setWeeklyUsageStats] = useState<WeeklyStats[]>([]);

  // ── Compute effective theme ──────────────────────────────────────────────────
  const effectiveTheme: "light" | "dark" =
    settings.themeMode === "system" ? sysScheme : settings.themeMode;

  // ── Real-time system theme change handling ──────────────────────────────────
  useEffect(() => {
    if (rnColorScheme) {
      setSysScheme(rnColorScheme === "dark" ? "dark" : "light");
    }
  }, [rnColorScheme]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setSysScheme(colorScheme === "dark" ? "dark" : "light");
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ── Native System Theme Change Listener (Android Quick Settings) ─────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    try {
      const eventEmitter = new NativeEventEmitter();
      const subscription = eventEmitter.addListener(
        "onSystemThemeChanged",
        (event: { isDark: boolean }) => {
          if (event && typeof event.isDark === "boolean") {
            setSysScheme(event.isDark ? "dark" : "light");
          }
        }
      );
      return () => {
        subscription.remove();
      };
    } catch (e) {
      console.warn("Could not register onSystemThemeChanged listener", e);
    }
  }, []);

  useEffect(() => {
    setColorScheme(settings.themeMode);
  }, [settings.themeMode, setColorScheme]);

  // ── Synchronized permissions check ──────────────────────────────────────────
  const refreshPermissions = useCallback(async (): Promise<boolean> => {
    const usageStats = await NativeBridge.checkUsageStatsPermission();
    const overlay = await NativeBridge.checkOverlayPermission();
    const accessibility = await NativeBridge.checkAccessibilityPermission();
    const deviceAdmin = await NativeBridge.isDeviceAdminActive();

    const newPerms = { usageStats, overlay, accessibility, deviceAdmin };
    setPermissions(newPerms);

    return usageStats && overlay && accessibility && deviceAdmin;
  }, []);

  // ── Synchronized usage stats query (UsageStatsManager) ───────────────────────
  const refreshUsageStats = useCallback(async () => {
    try {
      const hasPerm = await NativeBridge.checkUsageStatsPermission();
      if (!hasPerm) {
        return;
      }

      const [dayStats, weekly] = await Promise.all([
        NativeBridge.getDayUsageStats(0),
        NativeBridge.getWeeklyUsageStats(),
      ]);

      if (Array.isArray(dayStats)) {
        setTodayDeviceUsage(dayStats);
        const total = dayStats.reduce((acc, curr) => acc + curr.usedMs, 0);
        setTodayTotalUsageMs(total);
      }

      if (Array.isArray(weekly) && weekly.length > 0) {
        setWeeklyUsageStats(weekly);
      }
    } catch (err) {
      console.error("Error refreshing usage stats", err);
    }
  }, []);

  // ── Refresh all application data ─────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    const loadedSettings = await StorageService.getSettings();
    setSettings(loadedSettings);

    let loadedApps = await StorageService.getTrackedApps();
    const installedApps = await NativeBridge.getInstalledApps();
    const installedMap = new Map(installedApps.map((a) => [a.packageName, a]));

    // Auto-clean uninstalled apps if enabled (default true)
    if (loadedSettings.autoCleanUninstalled !== false) {
      const validApps = loadedApps.filter(
        (app) => app.packageName.startsWith("custom.") || installedMap.has(app.packageName)
      );

      if (validApps.length !== loadedApps.length) {
        loadedApps = validApps;
      }
    }

    // Hydrate missing iconUri and iconBase64 on trackedApps if not present
    let appsUpdatedWithIcons = false;
    loadedApps = loadedApps.map((app) => {
      const installed = installedMap.get(app.packageName);
      if (installed) {
        const needsUri = installed.iconUri && !app.iconUri;
        const needsBase64 = installed.iconBase64 && !app.iconBase64;
        if (needsUri || needsBase64) {
          appsUpdatedWithIcons = true;
          return {
            ...app,
            iconUri: app.iconUri || installed.iconUri,
            iconBase64: app.iconBase64 || installed.iconBase64,
          };
        }
      }
      return app;
    });

    if (appsUpdatedWithIcons || (loadedSettings.autoCleanUninstalled !== false && loadedApps.length !== (await StorageService.getTrackedApps()).length)) {
      await StorageService.saveTrackedApps(loadedApps);
    }

    setTrackedApps(loadedApps);

    // Sync locked packages list to Native Accessibility Service & EncryptedSharedPreferences
    const lockedPkgs = loadedApps
      .filter((a) => a.isLocked || a.usedTodayMs >= a.dailyLimitMs)
      .map((a) => a.packageName);

    NativeBridge.syncLockedPackages(lockedPkgs);
    NativeBridge.syncLockedAppsToNative(JSON.stringify(loadedApps));

    await refreshPermissions();
    await refreshUsageStats();
  }, [refreshPermissions, refreshUsageStats]);

  useEffect(() => {
    const init = async () => {
      const onboardingCompleted = await StorageService.isOnboardingCompleted();
      const allPerms = await refreshPermissions();

      if (!onboardingCompleted) {
        setCurrentScreen("onboarding");
      } else if (!allPerms) {
        setCurrentScreen("permissions");
      } else {
        setCurrentScreen("home");
      }

      await refreshData();
    };

    init();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshData();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [refreshPermissions, refreshData]);

  // Periodically fetch real device usage stats from Native Android
  useEffect(() => {
    const fetchUsage = async () => {
      await refreshUsageStats();

      if (trackedApps.length === 0) return;
      let hasUpdates = false;
      const updatedApps = await Promise.all(
        trackedApps.map(async (app) => {
          if (app.packageName.startsWith("custom.")) return app;
          const realUsedMs = await NativeBridge.getTodayUsageStats(app.packageName);
          const timeDiff = Math.abs(realUsedMs - app.usedTodayMs);
          const isNowLocked = realUsedMs >= app.dailyLimitMs;
          const lockChanged = !app.isLocked && isNowLocked;

          if (timeDiff >= 1000 || lockChanged) {
            hasUpdates = true;
            return {
              ...app,
              usedTodayMs: realUsedMs,
              isLocked: app.isLocked || isNowLocked,
            };
          }
          return app;
        })
      );

      if (hasUpdates) {
        setTrackedApps(updatedApps);
        await StorageService.saveTrackedApps(updatedApps);
        NativeBridge.syncLockedAppsToNative(JSON.stringify(updatedApps));
      }
    };

    const interval = setInterval(fetchUsage, 3000);
    return () => clearInterval(interval);
  }, [trackedApps, refreshUsageStats]);

  const updateThemeMode = async (mode: "system" | "light" | "dark") => {
    const newSettings = { ...settings, themeMode: mode };
    setSettings(newSettings);
    await StorageService.saveSettings(newSettings);
    setColorScheme(mode);
  };

  const updateAutoCleanSetting = async (enabled: boolean) => {
    const newSettings = { ...settings, autoCleanUninstalled: enabled };
    setSettings(newSettings);
    await StorageService.saveSettings(newSettings);
    await refreshData();
  };

  const addTrackedApp = async (
    packageName: string,
    appName: string,
    dailyLimitMs: number,
    category?: string,
    iconName?: string,
    iconBase64?: string,
    iconUri?: string
  ) => {
    const result = await StorageService.addTrackedApp(
      packageName,
      appName,
      dailyLimitMs,
      category,
      iconName,
      iconBase64,
      iconUri
    );
    if (result.success) {
      await refreshData();
    }
    return result;
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        trackedApps,
        settings,
        permissions,
        refreshPermissions,
        updateThemeMode,
        updateAutoCleanSetting,
        addTrackedApp,
        activeBlockApp,
        setActiveBlockApp,
        colorScheme: sysScheme,
        effectiveTheme,
        refreshData,
        todayDeviceUsage,
        todayTotalUsageMs,
        weeklyUsageStats,
        refreshUsageStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
