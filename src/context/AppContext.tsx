import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Appearance } from "react-native";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { TrackedApp, Settings } from "../types";
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
    iconBase64?: string
  ) => Promise<{ success: boolean; error?: string }>;
  activeBlockApp: TrackedApp | null;
  setActiveBlockApp: (app: TrackedApp | null) => void;
  colorScheme: "light" | "dark";
  effectiveTheme: "light" | "dark";
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setColorScheme } = useNativeWindColorScheme();

  // ── All useState calls first — order must NEVER change ──────────────────────
  const [sysScheme, setSysScheme] = useState<"light" | "dark">(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("home");
  const [trackedApps, setTrackedApps] = useState<TrackedApp[]>([]);
  const [settings, setSettings] = useState<Settings>({ themeMode: "system", autoCleanUninstalled: true });
  const [permissions, setPermissions] = useState<NativePermissionsStatus>({
    usageStats: false,
    overlay: false,
    accessibility: false,
  });
  const [activeBlockApp, setActiveBlockApp] = useState<TrackedApp | null>(null);

  // Compute effective theme: manual override, or follow the OS
  const effectiveTheme: "light" | "dark" =
    settings.themeMode === "system" ? sysScheme : settings.themeMode;

  // ── Listen to live OS dark/light changes ────────────────────────────────────
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSysScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => subscription.remove();
  }, []);

  // ── Keep NativeWind colour-scheme in sync with effectiveTheme ───────────────
  useEffect(() => {
    setColorScheme(effectiveTheme);
  }, [effectiveTheme, setColorScheme]);

  const refreshPermissions = useCallback(async (): Promise<boolean> => {
    const usageStats = await NativeBridge.checkUsageStatsPermission();
    const overlay = await NativeBridge.checkOverlayPermission();
    const accessibility = await NativeBridge.checkAccessibilityPermission();

    const newPerms = { usageStats, overlay, accessibility };
    setPermissions(newPerms);

    const allGranted = usageStats && overlay && accessibility;
    return allGranted;
  }, []);

  const refreshData = useCallback(async () => {
    const loadedSettings = await StorageService.getSettings();
    setSettings(loadedSettings);

    let loadedApps = await StorageService.getTrackedApps();

    // Auto-clean uninstalled apps if enabled (default true)
    if (loadedSettings.autoCleanUninstalled !== false) {
      const installedApps = await NativeBridge.getInstalledApps();
      const installedSet = new Set(installedApps.map((a) => a.packageName));

      const validApps = loadedApps.filter(
        (app) => app.packageName.startsWith("custom.") || installedSet.has(app.packageName)
      );

      if (validApps.length !== loadedApps.length) {
        loadedApps = validApps;
        await StorageService.saveTrackedApps(validApps);
      }
    }

    setTrackedApps(loadedApps);

    // Sync locked packages list to Native Accessibility Service
    const lockedPkgs = loadedApps
      .filter((a) => a.isLocked || a.usedTodayMs >= a.dailyLimitMs)
      .map((a) => a.packageName);

    NativeBridge.syncLockedPackages(lockedPkgs);

    // Check permissions
    await refreshPermissions();
  }, [refreshPermissions]);

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
  }, [refreshPermissions, refreshData]);

  // Periodically fetch real device usage stats from Native Android for each tracked app
  useEffect(() => {
    const fetchUsage = async () => {
      if (trackedApps.length === 0) return;
      let hasUpdates = false;
      const updatedApps = await Promise.all(
        trackedApps.map(async (app) => {
          if (app.packageName.startsWith("custom.")) return app;
          const realUsedMs = await NativeBridge.getTodayUsageStats(app.packageName);
          if (realUsedMs !== app.usedTodayMs) {
            hasUpdates = true;
            const isNowLocked = realUsedMs >= app.dailyLimitMs;
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
      }
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, [trackedApps]);

  const updateThemeMode = async (mode: "system" | "light" | "dark") => {
    const newSettings = { ...settings, themeMode: mode };
    setSettings(newSettings);
    await StorageService.saveSettings(newSettings);
    const targetTheme = mode === "system" ? sysScheme : mode;
    setColorScheme(targetTheme);
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
    iconBase64?: string
  ) => {
    const result = await StorageService.addTrackedApp(
      packageName,
      appName,
      dailyLimitMs,
      category,
      iconName,
      iconBase64
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
