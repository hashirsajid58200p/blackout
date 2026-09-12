import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { NativeBridge } from "../services/nativeBridge";
import {
  Moon,
  Sun,
  Monitor,
  ShieldCheck,
  Info,
  Lock,
  Trash2,
  ChevronRight,
  Bell,
  Battery,
  Activity,
  RefreshCw,
  MoonStar,
  Vibrate,
} from "lucide-react-native";
import { TrackedApp, SystemDiagnostics } from "../types";
import { StorageService } from "../services/storage";
import { HapticsService } from "../services/haptics";

interface DialogConfig {
  visible: boolean;
  title: string;
  description: string;
  variant?: "default" | "danger" | "warning" | "info" | "success";
  calloutText?: string;
  calloutVariant?: "danger" | "warning" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  singleButton?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
}

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateThemeMode,
    updateAutoCleanSetting,
    updateNotificationSetting,
    updateHapticSetting,
    updateDowntimeSetting,
    trackedApps,
    permissions,
    setCurrentScreen,
    effectiveTheme,
    unlockTrackedApp,
    removeTrackedApp,
  } = useApp();

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";
  const isAutoCleanEnabled = settings.autoCleanUninstalled !== false;
  const isWarningNotifEnabled = settings.warningNotifications !== false;
  const isLockoutNotifEnabled = settings.lockoutNotifications !== false;
  const isMidnightNotifEnabled = settings.midnightResetNotifications !== false;
  const isStatusBarNotifEnabled = settings.statusBarNotification !== false;
  const isHapticEnabled = settings.hapticFeedback !== false;
  const downtime = settings.downtime || {
    enabled: false,
    startHour: 22,
    startMinute: 30,
    endHour: 6,
    endMinute: 30,
    activeDays: "everyday" as const,
  };

  const [isAdminActive, setIsAdminActive] = useState(false);
  const [isBatteryIgnored, setIsBatteryIgnored] = useState(false);
  const [hasNotifPermission, setHasNotifPermission] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [isRefreshingDiag, setIsRefreshingDiag] = useState(false);
  const [rearmedNotice, setRearmedNotice] = useState<string | null>(null);

  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({
    visible: false,
    title: "",
    description: "",
    onCancel: () => {},
  });

  const closeDialog = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  const loadNativeStatus = async () => {
    try {
      const [admin, battery, notif, diag] = await Promise.all([
        NativeBridge.isDeviceAdminActive(),
        NativeBridge.isBatteryOptimizationIgnored(),
        NativeBridge.hasNotificationPermission(),
        NativeBridge.getDiagnostics(),
      ]);
      setIsAdminActive(admin);
      setIsBatteryIgnored(battery);
      setHasNotifPermission(notif);
      setDiagnostics(diag);
    } catch (err) {
      console.warn("Failed to load native diagnostics", err);
    }
  };

  useEffect(() => {
    loadNativeStatus();
  }, []);

  const handleRefreshDiagnostics = async () => {
    HapticsService.tick();
    setIsRefreshingDiag(true);
    await loadNativeStatus();
    setTimeout(() => setIsRefreshingDiag(false), 400);
  };

  const handleRearmDiagnostics = async () => {
    HapticsService.stamp();
    setIsRefreshingDiag(true);
    try {
      const res = await NativeBridge.rearmDiagnostics();
      setDiagnostics(res);
      setRearmedNotice("ALL ENGINES ARMED & SYNCHRONIZED");
      setTimeout(() => setRearmedNotice(null), 3500);
    } catch (err) {
      console.warn("rearmDiagnostics error", err);
    } finally {
      setIsRefreshingDiag(false);
    }
  };

  const handleRequestBatteryExemption = async () => {
    HapticsService.tick();
    await NativeBridge.requestIgnoreBatteryOptimization();
    setTimeout(loadNativeStatus, 1200);
  };

  const handleRequestNotificationPermission = async () => {
    const granted = await NativeBridge.requestNotificationPermission();
    setHasNotifPermission(granted);
    setTimeout(loadNativeStatus, 400);
  };

  const handleRequestDeviceAdmin = async () => {
    await NativeBridge.requestDeviceAdmin();
    const active = await NativeBridge.isDeviceAdminActive();
    setIsAdminActive(active);
  };

  const handleUnlockPress = (app: TrackedApp) => {
    const now = Date.now();
    const expiration = app.lockExpirationTimestamp || StorageService.getNextMidnightTimestamp();
    if (app.isLocked) {
      if (now < expiration) {
        setDialogConfig({
          visible: true,
          title: "LOCK ACTIVE",
          description:
            "This application is currently locked and cannot be unlocked until midnight in accordance with Blackout rules.",
          variant: "danger",
          calloutText: "This lock cannot be edited, paused, or undone today.",
          calloutVariant: "danger",
          singleButton: true,
          confirmLabel: "ACKNOWLEDGE",
          onCancel: closeDialog,
        });
        return;
      }
      setDialogConfig({
        visible: true,
        title: "UNLOCK APPLICATION",
        description: `The lock period has completed. Restore normal access to ${app.appName}?`,
        variant: "info",
        confirmLabel: "UNLOCK",
        cancelLabel: "CANCEL",
        onConfirm: async () => {
          const res = await unlockTrackedApp(app.packageName);
          if (res.success) {
            setDialogConfig({
              visible: true,
              title: "UNLOCKED",
              description: `${app.appName} has been unlocked. Normal daily behavior restored.`,
              variant: "success",
              singleButton: true,
              confirmLabel: "DISMISS",
              onCancel: closeDialog,
            });
          } else {
            setDialogConfig({
              visible: true,
              title: "UNLOCK ERROR",
              description: res.error || "Could not unlock app.",
              variant: "danger",
              singleButton: true,
              confirmLabel: "DISMISS",
              onCancel: closeDialog,
            });
          }
        },
        onCancel: closeDialog,
      });
    } else {
      setDialogConfig({
        visible: true,
        title: "REMOVE APP LIMIT",
        description: `Stop tracking and remove daily limit for ${app.appName}? Normal access will no longer be restricted.`,
        variant: "danger",
        confirmLabel: "REMOVE LIMIT",
        cancelLabel: "KEEP TRACKING",
        calloutText: "Allowance and tracking history will be reset.",
        calloutVariant: "warning",
        onConfirm: async () => {
          const res = await removeTrackedApp(app.packageName);
          if (res.success) {
            closeDialog();
          } else {
            setDialogConfig({
              visible: true,
              title: "CANNOT REMOVE",
              description: res.error || "Could not remove app.",
              variant: "danger",
              singleButton: true,
              confirmLabel: "DISMISS",
              onCancel: closeDialog,
            });
          }
        },
        onCancel: closeDialog,
      });
    }
  };

  const themeOptions: Array<{ mode: "system" | "light" | "dark"; label: string; icon: any }> = [
    { mode: "system", label: "SYSTEM", icon: Monitor },
    { mode: "light", label: "LIGHT", icon: Sun },
    { mode: "dark", label: "DARK", icon: Moon },
  ];

  return (
    <View className="flex-1 bg-paper dark:bg-espresso">
      <NavigationHeader title="SETTINGS" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="px-margin-page pt-4 flex-1">
        {/* Title: Serif Display */}
        <Text numberOfLines={1} className="font-display text-3xl text-ink dark:text-bone tracking-tight mb-4">
          Preferences
        </Text>

        {/* Section 1: Appearance / Theme */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            THEME MODE
          </Text>

          <View className="flex-row gap-2">
            {themeOptions.map((item) => {
              const IconComp = item.icon;
              const isSelected = settings.themeMode === item.mode;
              const buttonIconColor = isSelected
                ? isDark
                  ? "#12161F"
                  : "#E6E8EC"
                : isDark
                ? "#E6E8EC"
                : "#1A2030";

              return (
                <TouchableOpacity
                  key={item.mode}
                  activeOpacity={0.7}
                  onPress={() => {
                    HapticsService.tick();
                    updateThemeMode(item.mode);
                  }}
                  className={`flex-1 py-3.5 px-2 border rounded-none flex-col items-center gap-2 ${
                    isSelected
                      ? "border-ink bg-ink dark:border-bone dark:bg-bone"
                      : "border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface active:bg-ink/5 dark:active:bg-bone/5"
                  }`}
                >
                  <IconComp size={18} strokeWidth={1.25} color={buttonIconColor} />
                  <Text
                    className={`font-body-bold text-xs uppercase tracking-[0.12em] ${
                      isSelected
                        ? "text-paper dark:text-espresso"
                        : "text-ink dark:text-bone"
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section: Notification Preferences */}
        <View className="flex-col gap-2.5 mb-6">
          <View className="flex-row justify-between items-center px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              NOTIFICATION PREFERENCES
            </Text>
            <Bell size={14} strokeWidth={1.25} color={iconColor} />
          </View>

          {/* Android 13+ Permission Warning if Denied */}
          {!hasNotifPermission && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleRequestNotificationPermission}
              className="p-3 border border-stamp-red/40 bg-stamp-red/10 rounded-none flex-row items-center justify-between"
            >
              <View className="flex-1 mr-2">
                <Text className="font-body-bold text-xs text-stamp-red uppercase tracking-[0.08em]">
                  NOTIFICATION PERMISSION REQUIRED
                </Text>
                <Text className="font-body text-[11px] text-stamp-red/80 mt-0.5 leading-4">
                  Android 13+ requires explicit authorization to deliver warning alerts and reset reports.
                </Text>
              </View>
              <View className="px-2 py-1 bg-stamp-red rounded-none">
                <Text className="font-mono-bold text-[10px] text-white uppercase">GRANT</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Toggle 1: 5-Minute Warning */}
          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                  5-MINUTE WARNING ALERTS
                </Text>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-1 leading-relaxed">
                  Display a heads-up alert 5 minutes before an active allowance expires and locks out.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  HapticsService.tick();
                  updateNotificationSetting("warningNotifications", !isWarningNotifEnabled);
                }}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isWarningNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isWarningNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isWarningNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isWarningNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Toggle 2: Lockout Confirmations */}
          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                  LOCKOUT CONFIRMATIONS
                </Text>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-1 leading-relaxed">
                  Notify immediately when an application limit expires and access is sealed until midnight.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  HapticsService.tick();
                  updateNotificationSetting("lockoutNotifications", !isLockoutNotifEnabled);
                }}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isLockoutNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isLockoutNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isLockoutNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isLockoutNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Toggle 3: Midnight Reset Brief */}
          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                  DAILY MIDNIGHT RESET REPORT
                </Text>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-1 leading-relaxed">
                  Deliver a clean status ledger at 12:00 AM as quotas restore for the new day.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  HapticsService.tick();
                  updateNotificationSetting("midnightResetNotifications", !isMidnightNotifEnabled);
                }}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isMidnightNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isMidnightNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isMidnightNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isMidnightNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Toggle 4: Ongoing Status Bar Indicator */}
          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                  ONGOING STATUS BAR INDICATOR
                </Text>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-1 leading-relaxed">
                  Display a low-priority ongoing status indicator showing active tracked apps and today's total screen time.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  HapticsService.tick();
                  updateNotificationSetting("statusBarNotification", !isStatusBarNotifEnabled);
                }}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isStatusBarNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isStatusBarNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isStatusBarNotifEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isStatusBarNotifEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section: Background Reliability */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            BACKGROUND RELIABILITY (DOZE EXEMPTION)
          </Text>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center gap-2.5 mb-1.5">
              <Battery size={18} strokeWidth={1.25} color={iconColor} />
              <Text
                numberOfLines={1}
                className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone flex-1"
              >
                BATTERY OPTIMIZATION
              </Text>
              <Text
                className={`font-mono-bold text-[10px] uppercase tracking-[0.1em] ${
                  isBatteryIgnored ? "text-brass dark:text-brass" : "text-stamp-red"
                }`}
              >
                {isBatteryIgnored ? "UNRESTRICTED" : "RESTRICTED"}
              </Text>
            </View>

            <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed mb-3">
              Aggressive OEM power management can kill accessibility services and delay midnight alarms during deep sleep. Exempt Blackout to ensure uninterrupted background enforcement.
            </Text>

            {!isBatteryIgnored && (
              <View className="flex-row justify-end">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleRequestBatteryExemption}
                  className="px-3 py-1.5 border border-hairline dark:border-hairline-dark bg-paper dark:bg-espresso active:bg-ink/5 dark:active:bg-bone/5 rounded-none"
                >
                  <Text className="font-body-bold text-xs uppercase tracking-[0.1em] text-ink dark:text-bone">
                    REQUEST EXEMPTION
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Section: Scheduled Downtime (Night Watch) */}
        <View className="flex-col gap-2.5 mb-6">
          <View className="flex-row justify-between items-center px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              NIGHT WATCH // SCHEDULED DOWNTIME
            </Text>
            <MoonStar size={14} strokeWidth={1.25} color={iconColor} />
          </View>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            {/* Header + Toggle */}
            <View className="flex-row items-center justify-between pb-3 border-b border-hairline/40 dark:border-hairline-dark/40">
              <View className="flex-1 mr-3">
                <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                  DOWNTIME CURFEW
                </Text>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-1 leading-relaxed">
                  Enforce a blanket lockdown on tracked apps during designated quiet/bedtime hours.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  HapticsService.tick();
                  updateDowntimeSetting({ ...downtime, enabled: !downtime.enabled });
                }}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!downtime.enabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!downtime.enabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${downtime.enabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${downtime.enabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Time Window Steppers (when enabled) */}
            {downtime.enabled && (
              <View className="pt-4 flex-col gap-4">
                {/* Active Days Selector */}
                <View className="flex-col gap-1.5">
                  <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
                    ACTIVE SCHEDULE
                  </Text>
                  <View className="flex-row gap-1.5">
                    {(["everyday", "weekdays", "weekends"] as const).map((days) => {
                      const isSelected = downtime.activeDays === days;
                      return (
                        <TouchableOpacity
                          key={days}
                          activeOpacity={0.7}
                          onPress={() => {
                            HapticsService.tick();
                            updateDowntimeSetting({ ...downtime, activeDays: days });
                          }}
                          className={`flex-1 py-1.5 border rounded-none items-center justify-center ${
                            isSelected
                              ? "border-ink dark:border-bone bg-ink dark:bg-bone"
                              : "border-hairline dark:border-hairline-dark bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                          }`}
                        >
                          <Text
                            className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                              isSelected
                                ? "text-paper dark:text-espresso font-mono-bold"
                                : "text-ink dark:text-bone"
                            }`}
                          >
                            {days}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Start & End Times */}
                <View className="flex-row gap-3">
                  {/* Bedtime Start */}
                  <View className="flex-1 border border-hairline dark:border-hairline-dark p-2.5 items-center">
                    <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] mb-2">
                      CURFEW START
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          HapticsService.tick();
                          const newH = (downtime.startHour + 23) % 24;
                          updateDowntimeSetting({ ...downtime, startHour: newH });
                        }}
                        className="w-7 h-7 border border-hairline dark:border-hairline-dark items-center justify-center"
                      >
                        <Text className="font-mono-bold text-sm text-ink dark:text-bone">-</Text>
                      </TouchableOpacity>
                      <Text className="font-mono-bold text-base text-ink dark:text-bone">
                        {String(downtime.startHour).padStart(2, "0")}:{String(downtime.startMinute).padStart(2, "0")}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          HapticsService.tick();
                          const newH = (downtime.startHour + 1) % 24;
                          updateDowntimeSetting({ ...downtime, startHour: newH });
                        }}
                        className="w-7 h-7 border border-hairline dark:border-hairline-dark items-center justify-center"
                      >
                        <Text className="font-mono-bold text-sm text-ink dark:text-bone">+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Curfew End */}
                  <View className="flex-1 border border-hairline dark:border-hairline-dark p-2.5 items-center">
                    <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] mb-2">
                      CURFEW END
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          HapticsService.tick();
                          const newH = (downtime.endHour + 23) % 24;
                          updateDowntimeSetting({ ...downtime, endHour: newH });
                        }}
                        className="w-7 h-7 border border-hairline dark:border-hairline-dark items-center justify-center"
                      >
                        <Text className="font-mono-bold text-sm text-ink dark:text-bone">-</Text>
                      </TouchableOpacity>
                      <Text className="font-mono-bold text-base text-ink dark:text-bone">
                        {String(downtime.endHour).padStart(2, "0")}:{String(downtime.endMinute).padStart(2, "0")}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          HapticsService.tick();
                          const newH = (downtime.endHour + 1) % 24;
                          updateDowntimeSetting({ ...downtime, endHour: newH });
                        }}
                        className="w-7 h-7 border border-hairline dark:border-hairline-dark items-center justify-center"
                      >
                        <Text className="font-mono-bold text-sm text-ink dark:text-bone">+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Section: Haptics & Mechanical Feel */}
        <View className="flex-col gap-2.5 mb-6">
          <View className="flex-row justify-between items-center px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              AUDIO & MECHANICAL HAPTICS
            </Text>
            <Vibrate size={14} strokeWidth={1.25} color={iconColor} />
          </View>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                  TACTILE MECHANICAL FEEDBACK
                </Text>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-1 leading-relaxed">
                  Simulate vintage instrument tactile clicks for steppers, switches, and heavy stamp strikes on lock enforcement.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const next = !isHapticEnabled;
                  if (next) HapticsService.stamp();
                  updateHapticSetting(next);
                }}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isHapticEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isHapticEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isHapticEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isHapticEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section: System Diagnostics */}
        <View className="flex-col gap-2.5 mb-6">
          <View className="flex-row justify-between items-center px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              SYSTEM DIAGNOSTICS & HEALTH
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleRefreshDiagnostics}
              className="flex-row items-center gap-1.5"
            >
              {isRefreshingDiag ? (
                <ActivityIndicator size="small" color={iconColor} />
              ) : (
                <RefreshCw size={13} strokeWidth={1.25} color={iconColor} />
              )}
              <Text className="font-mono text-[10px] text-ink-muted dark:text-bone-muted uppercase">
                REFRESH
              </Text>
            </TouchableOpacity>
          </View>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col gap-3 rounded-none">
            {[
              {
                label: "ACCESSIBILITY MONITOR",
                status: diagnostics?.isAccessibilityActive ? "ONLINE" : "OFFLINE",
                active: diagnostics?.isAccessibilityActive,
              },
              {
                label: "MIDNIGHT RESET ENGINE",
                status: diagnostics?.nextMidnightTimestamp ? "SCHEDULED (12:00 AM)" : "UNSCHEDULED",
                active: !!diagnostics?.nextMidnightTimestamp,
              },
              {
                label: "NIGHT WATCH SCHEDULE",
                status: diagnostics?.downtimeActive
                  ? `ACTIVE (${diagnostics?.downtimeWindow || "CURFEW"})`
                  : settings.downtime?.enabled
                  ? `ARMED (${String(downtime.startHour).padStart(2, "0")}:${String(downtime.startMinute).padStart(2, "0")} - ${String(downtime.endHour).padStart(2, "0")}:${String(downtime.endMinute).padStart(2, "0")})`
                  : "DISABLED",
                active: settings.downtime?.enabled,
              },
              {
                label: "BATTERY OPTIMIZATION",
                status: diagnostics?.isBatteryIgnored ? "EXEMPT (OPTIMAL)" : "RESTRICTED (DOZE)",
                active: diagnostics?.isBatteryIgnored,
              },
              {
                label: "NOTIFICATION CHANNEL",
                status: diagnostics?.isNotificationGranted ? "ACTIVE" : "BLOCKED",
                active: diagnostics?.isNotificationGranted,
              },
              {
                label: "DEVICE ADMIN SHIELD",
                status: diagnostics?.isDeviceAdminActive ? "ACTIVE" : "UNPROTECTED",
                active: diagnostics?.isDeviceAdminActive,
              },
            ].map((diagRow) => (
              <View key={diagRow.label} className="flex-row justify-between items-center py-1 border-b border-hairline/40 dark:border-hairline-dark/40 last:border-b-0">
                <Text className="font-mono text-xs text-ink dark:text-bone uppercase">
                  {diagRow.label}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`w-2 h-2 rounded-none ${
                      diagRow.active ? "bg-brass dark:bg-brass" : "bg-stamp-red"
                    }`}
                  />
                  <Text
                    className={`font-mono-bold text-[11px] uppercase ${
                      diagRow.active ? "text-brass dark:text-brass" : "text-stamp-red"
                    }`}
                  >
                    {diagRow.status}
                  </Text>
                </View>
              </View>
            ))}

            <View className="pt-2 flex-row justify-between items-center">
              <Text className="font-mono text-[11px] text-ink-muted dark:text-bone-muted uppercase">
                REGISTRY STATE
              </Text>
              <Text className="font-mono-bold text-[11px] text-ink dark:text-bone uppercase">
                {trackedApps.length} TRACKED • {trackedApps.filter((a) => a.isLocked).length} LOCKED
              </Text>
            </View>

            {/* Re-Arm / Self-Test Button */}
            <View className="pt-3 border-t border-hairline/40 dark:border-hairline-dark/40 flex-col gap-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleRearmDiagnostics}
                className="border border-ink dark:border-bone bg-ink dark:bg-bone py-2.5 px-3 rounded-none flex-row items-center justify-center gap-2"
              >
                {isRefreshingDiag ? (
                  <ActivityIndicator size="small" color={isDark ? "#12161F" : "#E6E8EC"} />
                ) : (
                  <RefreshCw size={13} color={isDark ? "#12161F" : "#E6E8EC"} strokeWidth={1.5} />
                )}
                <Text className="font-body-bold text-xs uppercase tracking-[0.1em] text-paper dark:text-espresso">
                  RE-ARM & SELF-TEST ALL SERVICES
                </Text>
              </TouchableOpacity>

              {rearmedNotice && (
                <View className="p-2 bg-brass/10 border border-brass/50 items-center">
                  <Text className="text-[10px] font-mono-bold text-brass uppercase tracking-[0.08em]">
                    ✓ {rearmedNotice}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Section: Device Admin Uninstall Protection */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            UNINSTALL PROTECTION (DEVICE ADMIN)
          </Text>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center gap-2.5 mb-1.5">
              <ShieldCheck size={18} strokeWidth={1.25} color={iconColor} />
              <Text
                numberOfLines={1}
                className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone flex-1"
              >
                PREVENT UNINSTALLING
              </Text>
            </View>

            <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed mb-3">
              Activate Android Device Administrator privileges to prevent bypassing locked applications by removing Blackout.
            </Text>

            <View className="flex-row justify-end">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleRequestDeviceAdmin}
                className={`px-3 py-1.5 border rounded-none ${
                  isAdminActive
                    ? "bg-brass/15 border-brass/50 dark:border-brass/50"
                    : "border-hairline dark:border-hairline-dark bg-paper dark:bg-espresso active:bg-ink/5 dark:active:bg-bone/5"
                }`}
              >
                <Text
                  className={`font-body-bold text-xs uppercase tracking-[0.1em] ${
                    isAdminActive
                      ? "text-brass dark:text-brass"
                      : "text-ink dark:text-bone"
                  }`}
                >
                  {isAdminActive ? "PROTECTION ACTIVE" : "ACTIVATE ADMIN"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section: Auto-Clean Maintenance */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            MAINTENANCE
          </Text>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center gap-2.5 mb-1.5">
                  <Trash2 size={18} strokeWidth={1.25} color={iconColor} />
                  <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                    AUTO-CLEAN UNINSTALLED APPS
                  </Text>
                </View>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed">
                  Automatically purge tracked configurations when an application is uninstalled from Android.
                </Text>
              </View>

              {/* Mechanical Bracket Switch [ OFF | ON ] per DESIGN.md */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => updateAutoCleanSetting(!isAutoCleanEnabled)}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isAutoCleanEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isAutoCleanEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isAutoCleanEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isAutoCleanEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 3: Active Today's Locks (View Only) */}
        <View className="flex-col gap-2.5 mb-6">
          <View className="flex-row justify-between items-center px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              ACTIVE TODAY'S LOCKS
            </Text>
            <Lock size={14} strokeWidth={1.25} color={iconColor} />
          </View>

          {trackedApps.length === 0 ? (
            <Card className="py-4 items-center border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded-none">
              <Text className="font-body text-xs text-ink-muted dark:text-bone-muted uppercase">
                No active locks configured
              </Text>
            </Card>
          ) : (
            trackedApps.map((app) => (
              <TouchableOpacity
                key={app.packageName}
                activeOpacity={0.7}
                onPress={() => handleUnlockPress(app)}
                className="flex-row justify-between items-center py-3 px-3.5 border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded-none active:bg-ink/5 dark:active:bg-bone/5"
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  {app.iconUri ? (
                    <Image
                      source={{ uri: app.iconUri }}
                      className="w-7 h-7 rounded-none"
                      resizeMode="contain"
                    />
                  ) : app.iconBase64 ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                      className="w-7 h-7 rounded-none"
                      resizeMode="contain"
                    />
                  ) : (
                    <View className="w-7 h-7 bg-paper dark:bg-espresso border border-hairline dark:border-hairline-dark rounded-none items-center justify-center">
                      <Text className="font-display text-xs text-ink dark:text-bone font-bold">
                        {app.appName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text numberOfLines={1} className="font-body-bold text-sm text-ink dark:text-bone uppercase tracking-wider flex-1">
                    {app.appName}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className={`font-mono-bold text-[10px] uppercase tracking-[0.1em] ${app.isLocked ? "text-stamp-red" : "text-brass dark:text-brass"}`}>
                    {app.isLocked ? "LOCKED" : "RUNNING"}
                  </Text>
                  <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted uppercase">
                    • {Math.round(app.dailyLimitMs / (1000 * 60))}M
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text className="font-body text-xs text-ink-muted dark:text-bone-muted px-1 mt-1 leading-4">
            Note: In accordance with Blackout rules, active daily limits cannot be paused, edited, or deleted until midnight.
          </Text>
        </View>

        {/* Section 4: Permissions Status */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            PERMISSIONS STATUS
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentScreen("permissions")}
            className="border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface p-4 flex-col rounded-none active:bg-ink/5 dark:active:bg-bone/5"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5 flex-1">
                <ShieldCheck size={18} strokeWidth={1.25} color={iconColor} />
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone"
                  >
                    SYSTEM PERMISSIONS
                  </Text>
                  <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-0.5">
                    {permissions.usageStats && permissions.overlay && permissions.accessibility && permissions.deviceAdmin
                      ? "ALL 4 PERMISSIONS GRANTED"
                      : "ACTION REQUIRED — TAP TO REVIEW"}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} strokeWidth={1.25} color={iconColor} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 5: About Blackout */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            ABOUT BLACKOUT
          </Text>

          <Card className="flex-col p-4 rounded-none border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface">
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center gap-2.5">
                <Info size={18} strokeWidth={1.25} color={iconColor} />
                <Text className="font-body-bold text-sm text-ink dark:text-bone uppercase tracking-[0.1em]">
                  BLACKOUT
                </Text>
              </View>
              <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted">
                v1.0.0
              </Text>
            </View>
            <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed">
              An analog-inspired, offline, zero-telemetry Android digital wellbeing utility engineered for uncompromised cognitive focus.
            </Text>
          </Card>
        </View>
      </ScrollView>

      <BottomNavBar />

      {dialogConfig.visible && (
        <Modal
          visible={dialogConfig.visible}
          title={dialogConfig.title}
          description={dialogConfig.description}
          variant={dialogConfig.variant}
          calloutText={dialogConfig.calloutText}
          calloutVariant={dialogConfig.calloutVariant}
          confirmLabel={dialogConfig.confirmLabel}
          cancelLabel={dialogConfig.cancelLabel}
          singleButton={dialogConfig.singleButton}
          onConfirm={dialogConfig.onConfirm}
          onCancel={dialogConfig.onCancel}
        />
      )}
    </View>
  );
};
