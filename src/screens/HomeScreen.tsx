import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { StatusPill } from "../components/ui/StatusPill";
import { Plus, ShieldAlert, Lock } from "lucide-react-native";
import { TrackedApp } from "../types";
import { StorageService } from "../services/storage";

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
  } = useApp();
  const [selectedAppPackage, setSelectedAppPackage] = useState<string | null>(null);

  const handleUnlockPress = (app: TrackedApp) => {
    const now = Date.now();
    const expiration = app.lockExpirationTimestamp || StorageService.getNextMidnightTimestamp();
    if (app.isLocked) {
      if (now < expiration) {
        Alert.alert(
          "Lock Active",
          "This application is locked and cannot be unlocked until midnight in accordance with Blackout rules."
        );
        return;
      }
      Alert.alert(
        "Unlock Application",
        `The lock period has completed. Restore normal access to ${app.appName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlock",
            style: "destructive",
            onPress: async () => {
              const res = await unlockTrackedApp(app.packageName);
              if (res.success) {
                Alert.alert("Unlocked", `${app.appName} has been unlocked. Normal access restored.`);
              } else {
                Alert.alert("Unlock Error", res.error || "Could not unlock app.");
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Timer Running",
        `${app.appName} is being monitored with an active daily allowance. It will lock automatically once the configured duration completes.`
      );
    }
  };

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#EDE4D3" : "#2B2621";
  const fabIconColor = isDark ? "#1B1712" : "#F4EFE4";

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

  const formatMs = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const minsRem = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${minsRem}m`;
    }
    return `${minsRem}m`;
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
      return isDarkTheme ? "#EDE4D3" : "#2B2621";
    }
    const palette = isDarkTheme
      ? ["#EDE4D3", "#D9CEB9", "#A89A85", "#8C7F70", "#6E7A54", "#6E6459", "#52493F"]
      : ["#2B2621", "#4A4036", "#6E6459", "#8C7F70", "#6E7A54", "#A89A85", "#C2B6A3"];
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

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-margin-page pt-4 flex-1">
        {/* Date Header */}
        <View className="flex-col gap-1 mb-6">
          <Text className="font-display text-3xl text-ink dark:text-bone tracking-tight">
            Focus
          </Text>
          <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted uppercase tracking-widest">
            {getTodayFormatted()}
          </Text>
        </View>

        {/* Permission Notice if missing */}
        {(!permissions.usageStats || !permissions.overlay || !permissions.accessibility || !permissions.deviceAdmin) && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentScreen("permissions")}
            className="border border-stamp-red/40 bg-stamp-red/10 p-3.5 mb-6 flex-col rounded"
          >
            <View className="flex-row items-center gap-2 mb-1">
              <ShieldAlert size={16} color="#B23A2E" strokeWidth={1.25} />
              <Text className="font-body-semibold text-xs uppercase tracking-wider text-stamp-red flex-1">
                Permissions Required
              </Text>
            </View>
            <Text className="font-body text-xs text-stamp-red/90 leading-4">
              Tap to grant Usage Access, Overlay, Accessibility & Device Admin privileges
            </Text>
          </TouchableOpacity>
        )}

        {/* Multi-Segment Warm Donut Chart */}
        <Card className="p-5 mb-6 items-center justify-center flex-col">
          <View className="w-full flex-row justify-between items-center mb-4">
            <Text className="font-body-semibold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-widest">
              Today's Usage Overview
            </Text>
            <Text className="font-mono-bold text-xs text-ink dark:text-bone">
              {formatMs(totalUsedTodayMs)}
            </Text>
          </View>

          {/* Circular SVG Chart */}
          <View className="relative w-48 h-48 items-center justify-center mb-4">
            <Svg width={192} height={192} viewBox="0 0 160 160">
              <Circle
                cx="80"
                cy="80"
                r="65"
                stroke={isDark ? "#3B3327" : "#D9CEB9"}
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
                  stroke={isDark ? "#EDE4D3" : "#2B2621"}
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
              <Text numberOfLines={1} className="font-display text-xs text-ink-muted dark:text-bone-muted tracking-wide mt-0.5 max-w-[110px] text-center">
                {activeFocusApp ? activeFocusApp.appName : "Total Usage"}
              </Text>
            </View>
          </View>

          {/* App Usage Segment Legend Breakdown */}
          {appSegments.length > 0 && (
            <View className="w-full flex-col gap-1.5 pt-3 border-t border-hairline/60 dark:border-hairline-dark/60">
              <Text className="text-[10px] font-body-semibold text-ink-muted dark:text-bone-muted uppercase tracking-widest mb-1">
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
                    className={`flex-row justify-between items-center py-1.5 px-2 rounded ${
                      isSelected
                        ? "border border-ink dark:border-bone bg-ink/5 dark:bg-bone/5"
                        : "border border-transparent"
                    }`}
                  >
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <View style={{ backgroundColor: seg.shadeColor }} className="w-3 h-3 rounded-sm border border-hairline dark:border-hairline-dark" />
                      <Text numberOfLines={1} className="font-body-medium text-xs text-ink dark:text-bone flex-1">
                        {seg.appName}
                      </Text>
                    </View>

                    <Text className="font-mono text-[11px] text-ink-muted dark:text-bone-muted">
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
          <Card className="py-12 items-center justify-center text-center">
            <Text className="font-display text-lg text-ink dark:text-bone mb-1">
              No App Locks Active
            </Text>
            <Text className="font-body text-xs text-ink-muted dark:text-bone-muted text-center max-w-[240px]">
              Tap the (+) button below to pick an installed app and set a daily limit.
            </Text>
          </Card>
        ) : (
          <View className="flex-col gap-3">
            <Text className="font-body-semibold text-xs text-ink-muted dark:text-bone-muted uppercase tracking-widest">
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
                  className="flex-col gap-2.5 p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      {app.iconUri ? (
                        <Image
                          source={{ uri: app.iconUri }}
                          className="w-9 h-9 rounded border border-hairline dark:border-hairline-dark"
                          resizeMode="cover"
                        />
                      ) : app.iconBase64 ? (
                        <Image
                          source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                          className="w-9 h-9 rounded border border-hairline dark:border-hairline-dark"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-9 h-9 rounded bg-paper dark:bg-espresso border border-hairline dark:border-hairline-dark items-center justify-center">
                          <Text className="font-display text-sm font-bold text-ink dark:text-bone">
                            {app.appName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        className="font-body-semibold text-sm text-ink dark:text-bone flex-1 leading-5"
                      >
                        {app.appName}
                      </Text>
                    </View>

                    <StatusPill isLocked={app.isLocked} />
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
                        className="mt-1.5 py-1.5 px-3 border border-stamp-red/40 bg-stamp-red/10 rounded flex-row items-center justify-center gap-1.5"
                      >
                        <Lock size={12} color="#B23A2E" strokeWidth={1.25} />
                        <Text className="font-mono-bold text-[10px] text-stamp-red uppercase tracking-wider">
                          {Date.now() < (app.lockExpirationTimestamp || StorageService.getNextMidnightTimestamp())
                            ? "LOCKED UNTIL MIDNIGHT"
                            : "UNLOCK APPLICATION"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleUnlockPress(app)}
                        className="mt-1.5 py-1.5 px-3 border border-stamp-olive/30 bg-stamp-olive/5 rounded flex-row items-center justify-center gap-1.5"
                      >
                        <Text className="font-mono-bold text-[10px] text-stamp-olive uppercase tracking-wider">
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
        className="absolute bottom-20 right-6 w-14 h-14 bg-ink dark:bg-bone rounded-full items-center justify-center z-40 border border-ink dark:border-bone shadow-none active:scale-95"
      >
        <Plus size={26} color={fabIconColor} strokeWidth={1.5} />
      </TouchableOpacity>

      <BottomNavBar />
    </View>
  );
};
