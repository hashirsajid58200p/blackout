import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { StatusPill } from "../components/ui/StatusPill";
import { Modal } from "../components/ui/Modal";
import { Plus, ShieldAlert, Lock, Trash2 } from "lucide-react-native";
import { TrackedApp } from "../types";
import { StorageService } from "../services/storage";

const formatMs = (ms: number): string => {
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const minsRem = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${minsRem}m`;
  }
  return `${minsRem}m`;
};

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

const CountdownBadge: React.FC<{
  remainingMs: number;
  isLocked: boolean;
}> = ({ remainingMs, isLocked }) => {
  const [localRemaining, setLocalRemaining] = useState(remainingMs);

  useEffect(() => {
    setLocalRemaining(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (isLocked || localRemaining <= 0 || localRemaining > 10000) {
      return;
    }
    const timer = setInterval(() => {
      setLocalRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, localRemaining <= 10000 && localRemaining > 0]);

  if (isLocked || localRemaining <= 0) {
    return null;
  }

  const isLast10Sec = localRemaining <= 10000;
  const label = isLast10Sec
    ? `${Math.max(1, Math.ceil(localRemaining / 1000))}`
    : `${Math.ceil(localRemaining / 60000)}`;

  return (
    <View
      className={`absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-none items-center justify-center border z-20 ${
        isLast10Sec
          ? "bg-stamp-red border-white/60"
          : "bg-paper-surface dark:bg-espresso-surface border-hairline dark:border-hairline-dark"
      }`}
    >
      <Text
        numberOfLines={1}
        className={`text-[8px] font-mono-bold leading-none ${
          isLast10Sec ? "text-white" : "text-ink dark:text-bone"
        }`}
      >
        {label}
      </Text>
    </View>
  );
};

export const HomeScreen: React.FC = () => {
  const {
    trackedApps,
    setCurrentScreen,
    permissions,
    effectiveTheme,
    todayDeviceUsage,
    todayTotalUsageMs,
    refreshUsageStats,
    unlockTrackedApp,
    removeTrackedApp,
    isInitialized,
  } = useApp();
  const [selectedAppPackage, setSelectedAppPackage] = useState<string | null>(null);
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({
    visible: false,
    title: "",
    description: "",
    onCancel: () => {},
  });

  const closeDialog = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  const promptRemoveApp = (app: TrackedApp) => {
    if (app.isLocked) {
      setDialogConfig({
        visible: true,
        title: "CANNOT REMOVE",
        description:
          "Locked applications cannot be removed until midnight in accordance with Blackout rules.",
        variant: "danger",
        singleButton: true,
        confirmLabel: "ACKNOWLEDGE",
        calloutText: "Active lock enforced until midnight.",
        calloutVariant: "danger",
        onCancel: closeDialog,
      });
      return;
    }

    setDialogConfig({
      visible: true,
      title: "REMOVE APP LIMIT",
      description: `Stop tracking and remove daily limit for ${app.appName}? Normal usage will no longer be restricted.`,
      variant: "danger",
      confirmLabel: "REMOVE LIMIT",
      cancelLabel: "KEEP TRACKING",
      calloutText: "Daily allowance and tracking history will be reset.",
      calloutVariant: "warning",
      onConfirm: async () => {
        const res = await removeTrackedApp(app.packageName);
        if (!res.success) {
          setDialogConfig({
            visible: true,
            title: "REMOVE ERROR",
            description: res.error || "Could not remove app.",
            variant: "danger",
            singleButton: true,
            confirmLabel: "DISMISS",
            onCancel: closeDialog,
          });
        } else {
          closeDialog();
        }
      },
      onCancel: closeDialog,
    });
  };

  const handleUnlockPress = (app: TrackedApp) => {
    const now = Date.now();
    const expiration = app.lockExpirationTimestamp || StorageService.getNextMidnightTimestamp();
    if (app.isLocked) {
      if (now < expiration) {
        setDialogConfig({
          visible: true,
          title: "LOCK ACTIVE",
          description: `${app.appName} is locked and cannot be unlocked until midnight in accordance with Blackout rules.`,
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
        description: `The daily lock period has completed. Restore normal access to ${app.appName}?`,
        variant: "info",
        confirmLabel: "UNLOCK",
        cancelLabel: "CANCEL",
        onConfirm: async () => {
          const res = await unlockTrackedApp(app.packageName);
          if (res.success) {
            setDialogConfig({
              visible: true,
              title: "UNLOCKED",
              description: `${app.appName} has been unlocked. Normal access restored.`,
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
      promptRemoveApp(app);
    }
  };

  const handleRemovePress = (app: TrackedApp) => {
    promptRemoveApp(app);
  };

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";
  const fabIconColor = isDark ? "#12161F" : "#E6E8EC";

  useEffect(() => {
    refreshUsageStats();
    const interval = setInterval(refreshUsageStats, 4000);
    return () => clearInterval(interval);
  }, [refreshUsageStats]);

  const getTodayFormatted = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
    };
    return new Date().toLocaleDateString("en-US", options).toUpperCase();
  };

  // Build unified chart apps list merging device usage with tracked limits
  const chartApps = todayDeviceUsage.map((d) => {
    const tracked = trackedApps.find((ta) => ta.packageName === d.packageName);
    return {
      packageName: d.packageName,
      appName: d.appName,
      usedTodayMs: d.usedMs,
      openCount: d.openCount,
      dailyLimitMs: tracked?.dailyLimitMs || 0,
      isLocked: tracked?.isLocked || false,
    };
  });

  // Include any tracked apps not in device usage yet
  trackedApps.forEach((ta) => {
    if (!chartApps.some((ca) => ca.packageName === ta.packageName)) {
      chartApps.push({
        packageName: ta.packageName,
        appName: ta.appName,
        usedTodayMs: ta.usedTodayMs || 0,
        openCount: 0,
        dailyLimitMs: ta.dailyLimitMs,
        isLocked: ta.isLocked,
      });
    }
  });

  const totalUsedTodayMs = todayTotalUsageMs > 0
    ? todayTotalUsageMs
    : chartApps.reduce((acc, curr) => acc + curr.usedTodayMs, 0);

  const circleCircumference = 408.4;

  const getDynamicVintageShade = (index: number, total: number, isDarkTheme: boolean): string => {
    if (total <= 1) {
      return isDarkTheme ? "#DFE2EF" : "#1A2030";
    }
    // Stitch Ledger Instrument calibrated tones: Primary bone/ink, burnished brass accents, and archival carbon grays
    const palette = isDarkTheme
      ? ["#F0BE78", "#DFE2EF", "#DDAD69", "#C0C6DB", "#909097", "#A67C3D", "#614003"]
      : ["#1A2030", "#A67C3D", "#5C6478", "#8A642B", "#2A3145", "#C9CDD6", "#3A4359"];
    return palette[index % palette.length];
  };

  const sortedApps = [...chartApps].sort((a, b) => b.usedTodayMs - a.usedTodayMs);

  let currentAngle = -90;
  const appSegments = sortedApps.map((app, index) => {
    const usageFraction = totalUsedTodayMs > 0 ? app.usedTodayMs / totalUsedTodayMs : 0;
    const strokeDash = usageFraction * circleCircumference;
    const startAngle = currentAngle;
    currentAngle += usageFraction * 360;
    const shadeColor = getDynamicVintageShade(index, sortedApps.length, isDark);

    return {
      packageName: app.packageName,
      appName: app.appName,
      usedTodayMs: app.usedTodayMs,
      dailyLimitMs: app.dailyLimitMs,
      openCount: app.openCount,
      usageFraction,
      strokeDash: Math.max(4, strokeDash),
      startAngle,
      shadeColor,
    };
  });

  const activeFocusApp = appSegments.find((a) => a.packageName === selectedAppPackage);

  return (
    <View className="flex-1 bg-paper dark:bg-espresso">
      <NavigationHeader title="HOME" />

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} className="px-margin-page pt-4 flex-1">
        {/* Date Header */}
        <View className="flex-col gap-1 mb-6">
          <Text className="font-display text-3xl text-ink dark:text-bone tracking-tight">
            Focus
          </Text>
          <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
            {getTodayFormatted()}
          </Text>
        </View>

        {/* Permission Notice if missing (guarded by isInitialized to avoid cold-launch false error flash) */}
        {isInitialized && (!permissions.usageStats || !permissions.overlay || !permissions.accessibility || !permissions.deviceAdmin) && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentScreen("permissions")}
            className="border border-stamp-red/40 bg-stamp-red/10 p-3.5 mb-6 flex-col rounded-none"
          >
            <View className="flex-row items-center gap-2 mb-1">
              <ShieldAlert size={16} color="#B23A2E" strokeWidth={1.25} />
              <Text className="font-body-bold text-xs uppercase tracking-[0.12em] text-stamp-red flex-1">
                Permissions Required
              </Text>
            </View>
            <Text className="font-body text-xs text-stamp-red/90 leading-4">
              Tap to grant Usage Access, Overlay, Accessibility & Device Admin privileges
            </Text>
          </TouchableOpacity>
        )}

        {/* Multi-Segment Donut Chart */}
        <Card className="p-5 mb-6 items-center justify-center flex-col">
          <View className="w-full flex-row justify-between items-center mb-4 px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] flex-1 pr-2">
              Today's Usage Overview
            </Text>
            <Text className="font-mono-bold text-xs text-ink dark:text-bone shrink-0">
              {isInitialized ? formatMs(totalUsedTodayMs) : "—"}
            </Text>
          </View>

          {/* Circular SVG Chart */}
          <View className="relative w-48 h-48 items-center justify-center mb-4">
            <Svg width={192} height={192} viewBox="0 0 160 160">
              <Circle
                cx="80"
                cy="80"
                r="65"
                stroke={isDark ? "#2A3145" : "#C9CDD6"}
                strokeWidth="12"
                fill="none"
              />

              {totalUsedTodayMs > 0 ? (
                appSegments.map((seg, idx) => {
                  if (seg.usedTodayMs <= 0) return null;
                  const isSelected = selectedAppPackage === seg.packageName;
                  return (
                    <Circle
                      key={idx}
                      cx="80"
                      cy="80"
                      r="65"
                      stroke={seg.shadeColor}
                      strokeWidth={isSelected ? "16" : "12"}
                      fill="none"
                      strokeDasharray={`${seg.strokeDash} ${circleCircumference - seg.strokeDash}`}
                      strokeLinecap="butt"
                      transform={`rotate(${seg.startAngle} 80 80)`}
                    />
                  );
                })
              ) : (
                <Circle
                  cx="80"
                  cy="80"
                  r="65"
                  stroke={isDark ? "#E6E8EC" : "#1A2030"}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray="408.4"
                  strokeLinecap="butt"
                  transform="rotate(-90 80 80)"
                />
              )}
            </Svg>

            <View className="absolute items-center justify-center pointer-events-none px-2 text-center">
              <Text numberOfLines={1} className="font-mono-bold text-2xl text-ink dark:text-bone">
                {activeFocusApp ? formatMs(activeFocusApp.usedTodayMs) : formatMs(totalUsedTodayMs)}
              </Text>
              <Text numberOfLines={1} className="font-display text-xs text-ink-muted dark:text-bone-muted tracking-[0.06em] mt-0.5 max-w-[110px] text-center uppercase">
                {activeFocusApp ? activeFocusApp.appName : "Total Usage"}
              </Text>
            </View>
          </View>

          {/* App Usage Segment Legend Breakdown */}
          {appSegments.length > 0 && (
            <View className="w-full flex-col gap-1.5 pt-3 border-t border-hairline/60 dark:border-hairline-dark/60">
              <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] mb-1">
                App Usage Breakdown (Tap to Highlight)
              </Text>
              {appSegments.slice(0, 8).map((seg) => {
                const percentOfTotal = totalUsedTodayMs > 0
                  ? Math.round((seg.usedTodayMs / totalUsedTodayMs) * 100)
                  : 0;
                const isSelected = selectedAppPackage === seg.packageName;

                return (
                  <TouchableOpacity
                    key={seg.packageName}
                    activeOpacity={0.7}
                    onPress={() => setSelectedAppPackage(isSelected ? null : seg.packageName)}
                    className={`flex-row justify-between items-center py-1.5 px-2 rounded-none ${
                      isSelected
                        ? "border border-ink dark:border-bone bg-ink/5 dark:bg-bone/5"
                        : "border border-transparent"
                    }`}
                  >
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <View style={{ backgroundColor: seg.shadeColor }} className="w-2.5 h-2.5 rounded-none border border-hairline dark:border-hairline-dark shrink-0" />
                      <Text numberOfLines={1} className="font-body text-xs text-ink dark:text-bone flex-1">
                        {seg.appName}
                      </Text>
                    </View>

                    <Text numberOfLines={1} className="font-mono text-[11px] text-ink-muted dark:text-bone-muted shrink-0">
                      {formatMs(seg.usedTodayMs)} ({percentOfTotal}%){seg.openCount ? ` • ${seg.openCount} opens` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        {/* Tracked Apps List */}
        {trackedApps.length === 0 ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentScreen("add_app")}
            className="w-full"
          >
            <Card className="py-10 items-center justify-center text-center border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded-none">
              <View className="w-10 h-10 rounded-none border border-hairline dark:border-hairline-dark items-center justify-center mb-3 bg-paper dark:bg-espresso">
                <Plus size={18} color={iconColor} strokeWidth={1.25} />
              </View>
              <Text className="font-display text-lg text-ink dark:text-bone mb-1 uppercase tracking-[0.06em]">
                No App Locks Active
              </Text>
              <Text className="font-body text-xs text-ink-muted dark:text-bone-muted text-center max-w-[240px]">
                Tap here or the (+) button below to pick an installed app and set a daily limit.
              </Text>
            </Card>
          </TouchableOpacity>
        ) : (
          <View className="flex-col gap-3">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              LOCKED APPLICATIONS
            </Text>

            {trackedApps.map((app) => {
              const percent = Math.min(
                100,
                Math.round((app.usedTodayMs / app.dailyLimitMs) * 100)
              );

              return (
                <Card
                  key={app.packageName}
                  variant={app.isLocked ? "locked" : "default"}
                  className="flex-col gap-2.5 p-4 rounded-none"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      <View className="relative">
                        {app.iconUri ? (
                          <Image
                            source={{ uri: app.iconUri }}
                            className="w-9 h-9 rounded-none"
                            resizeMode="contain"
                          />
                        ) : app.iconBase64 ? (
                          <Image
                            source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                            className="w-9 h-9 rounded-none"
                            resizeMode="contain"
                          />
                        ) : (
                          <View className="w-9 h-9 rounded-none bg-paper dark:bg-espresso border border-hairline dark:border-hairline-dark items-center justify-center">
                            <Text className="font-display text-sm font-bold text-ink dark:text-bone">
                              {app.appName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {!app.isLocked && app.dailyLimitMs > 0 && (
                          <CountdownBadge
                            remainingMs={Math.max(0, app.dailyLimitMs - app.usedTodayMs)}
                            isLocked={app.isLocked}
                          />
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        className="font-body-bold text-sm text-ink dark:text-bone flex-1 leading-5"
                      >
                        {app.appName}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-2">
                      {!app.isLocked && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleRemovePress(app)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="p-1.5 rounded-none border border-hairline dark:border-hairline-dark active:bg-ink/5 dark:active:bg-bone/5 items-center justify-center"
                        >
                          <Trash2 size={13} color={iconColor} strokeWidth={1.25} />
                        </TouchableOpacity>
                      )}
                      <StatusPill isLocked={app.isLocked} />
                    </View>
                  </View>

                  <View className="flex-col gap-1.5 w-full mt-1">
                    <View className="flex-row justify-between items-end">
                      <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted">
                        {formatMs(app.usedTodayMs)} / {formatMs(app.dailyLimitMs)} limit
                      </Text>
                      <Text className={`font-mono-bold text-xs ${app.isLocked ? "text-stamp-red" : "text-ink dark:text-bone"}`}>
                        {percent}%
                      </Text>
                    </View>

                    <ProgressBar progressPercent={percent} isLocked={app.isLocked} />

                    {app.isLocked ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleUnlockPress(app)}
                        className="mt-1.5 py-1.5 px-3 border border-stamp-red/50 bg-stamp-red/10 rounded-none flex-row items-center justify-center gap-1.5"
                      >
                        <Lock size={12} color="#B23A2E" strokeWidth={1.25} />
                        <Text className="font-mono-bold text-[10px] text-stamp-red uppercase tracking-[0.1em]">
                          {Date.now() < (app.lockExpirationTimestamp || StorageService.getNextMidnightTimestamp())
                            ? "LOCKED UNTIL MIDNIGHT"
                            : "UNLOCK APPLICATION"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleUnlockPress(app)}
                        className="mt-1.5 py-1.5 px-3 border border-brass/50 bg-brass/10 rounded-none flex-row items-center justify-center gap-1.5"
                      >
                        <Text className="font-mono-bold text-[10px] text-brass dark:text-brass uppercase tracking-[0.1em]">
                          ALLOWANCE ACTIVE • {formatMs(Math.max(0, app.dailyLimitMs - app.usedTodayMs))} REMAINING
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setCurrentScreen("add_app")}
        style={{ zIndex: 60 }}
        className="absolute bottom-[84px] right-5 w-14 h-14 bg-ink dark:bg-bone rounded-none items-center justify-center border border-ink dark:border-bone shadow-none active:scale-95"
      >
        <Plus size={24} color={fabIconColor} strokeWidth={1.5} />
      </TouchableOpacity>

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
