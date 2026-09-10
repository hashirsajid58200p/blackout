import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { StatusPill } from "../components/ui/StatusPill";
import { Plus, ShieldAlert } from "lucide-react-native";

export const HomeScreen: React.FC = () => {
  const {
    trackedApps,
    setCurrentScreen,
    permissions,
    effectiveTheme,
    todayDeviceUsage,
    todayTotalUsageMs,
    refreshUsageStats,
  } = useApp();
  const [selectedAppPackage, setSelectedAppPackage] = useState<string | null>(null);

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";
  const fabIconColor = isDark ? "#000000" : "#ffffff";

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
      isLocked: tracked?.isLocked || (tracked && tracked.dailyLimitMs > 0 && d.usedMs >= tracked.dailyLimitMs) || false,
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

  const getDynamicMonochromeShade = (index: number, total: number, isDarkTheme: boolean): string => {
    if (total <= 1) {
      return isDarkTheme ? "hsl(0, 0%, 100%)" : "hsl(0, 0%, 0%)";
    }
    const ratio = index / (total - 1);
    if (isDarkTheme) {
      const lightness = Math.round(100 - ratio * 65);
      return `hsl(0, 0%, ${lightness}%)`;
    } else {
      const lightness = Math.round(ratio * 70);
      return `hsl(0, 0%, ${lightness}%)`;
    }
  };

  const sortedApps = [...chartApps].sort((a, b) => b.usedTodayMs - a.usedTodayMs);

  let currentAngle = -90;
  const appSegments = sortedApps.map((app, index) => {
    const usageFraction = totalUsedTodayMs > 0 ? app.usedTodayMs / totalUsedTodayMs : 0;
    const strokeDash = usageFraction * circleCircumference;
    const startAngle = currentAngle;
    currentAngle += usageFraction * 360;
    const shadeColor = getDynamicMonochromeShade(index, sortedApps.length, isDark);

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
    <View className="flex-1 bg-background dark:bg-black">
      <NavigationHeader title="HOME" />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-margin-page pt-4 flex-1">
        {/* Date Header */}
        <View className="flex-col gap-1 mb-6">
          <Text className="font-bold text-3xl text-primary dark:text-white uppercase tracking-tight">
            FOCUS
          </Text>
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            {getTodayFormatted()}
          </Text>
        </View>

        {/* Permission Notice if missing */}
        {(!permissions.usageStats || !permissions.overlay || !permissions.accessibility || !permissions.deviceAdmin) && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCurrentScreen("permissions")}
            className="border-2 border-primary dark:border-white bg-surface-container dark:bg-black p-4 mb-6 flex-col rounded-none"
          >
            <View className="flex-row items-center gap-2.5 mb-1">
              <View className="w-5 h-5 items-center justify-center">
                <ShieldAlert size={20} color={iconColor} />
              </View>
              <Text className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5">
                PERMISSIONS REQUIRED
              </Text>
            </View>
            <Text className="text-xs text-secondary dark:text-zinc-400 leading-4">
              Tap to grant Usage Access, Overlay, Accessibility & Device Admin privileges
            </Text>
          </TouchableOpacity>
        )}

        {/* Multi-Segment Monochrome Donut Chart (ALWAYS ACCURATE & VISIBLE) */}
        <Card className="p-5 mb-6 items-center justify-center flex-col rounded-none bg-surface-container-lowest dark:bg-black">
          <View className="w-full flex-row justify-between items-center mb-4">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              TODAY'S USAGE OVERVIEW
            </Text>
            <Text className="font-bold text-xs text-primary dark:text-white uppercase">
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
                stroke={isDark ? "#27272a" : "#e4e4e7"}
                strokeWidth="14"
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
                      strokeWidth={isSelected ? "18" : "14"}
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
                  stroke={isDark ? "#ffffff" : "#000000"}
                  strokeWidth="14"
                  fill="none"
                  strokeDasharray="408.4"
                  strokeLinecap="butt"
                  transform="rotate(-90 80 80)"
                />
              )}
            </Svg>

            <View className="absolute items-center justify-center pointer-events-none px-2 text-center">
              <Text numberOfLines={1} className="font-bold text-2xl text-primary dark:text-white">
                {activeFocusApp ? formatMs(activeFocusApp.usedTodayMs) : formatMs(totalUsedTodayMs)}
              </Text>
              <Text numberOfLines={1} className="font-bold text-[10px] text-secondary dark:text-zinc-400 uppercase tracking-widest mt-0.5 max-w-[110px] text-center">
                {activeFocusApp ? activeFocusApp.appName : "TOTAL USAGE"}
              </Text>
            </View>
          </View>

          {/* App Usage Segment Legend Breakdown */}
          {appSegments.length > 0 && (
            <View className="w-full flex-col gap-2 pt-2 border-t border-primary/20 dark:border-white/20">
              <Text className="text-[10px] font-bold text-secondary dark:text-zinc-500 uppercase tracking-widest mb-1">
                APP USAGE BREAKDOWN (TAP TO HIGHLIGHT)
              </Text>
              {appSegments.slice(0, 8).map((seg) => {
                const percentOfTotal = totalUsedTodayMs > 0
                  ? Math.round((seg.usedTodayMs / totalUsedTodayMs) * 100)
                  : 0;
                const isSelected = selectedAppPackage === seg.packageName;

                return (
                  <TouchableOpacity
                    key={seg.packageName}
                    activeOpacity={0.8}
                    onPress={() => setSelectedAppPackage(isSelected ? null : seg.packageName)}
                    className={`flex-row justify-between items-center py-1.5 px-2 border ${
                      isSelected
                        ? "border-primary dark:border-white bg-primary/10 dark:bg-white/10"
                        : "border-transparent"
                    }`}
                  >
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <View style={{ backgroundColor: seg.shadeColor }} className="w-3.5 h-3.5 rounded-none border border-primary dark:border-white" />
                      <Text numberOfLines={1} className="font-bold text-xs text-primary dark:text-white uppercase flex-1">
                        {seg.appName}
                      </Text>
                    </View>

                    <Text className="font-bold text-[11px] text-secondary dark:text-zinc-300 uppercase">
                      {formatMs(seg.usedTodayMs)} ({percentOfTotal}%){seg.openCount ? ` • ${seg.openCount} OPENS` : ""}
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
            <Text className="font-bold text-lg uppercase text-primary dark:text-white mb-2">
              NO APP LOCKS ACTIVE
            </Text>
            <Text className="text-sm text-secondary dark:text-zinc-400 text-center max-w-[240px]">
              Tap the (+) button below to pick an installed app and set a daily limit.
            </Text>
          </Card>
        ) : (
          <View className="flex-col gap-3.5">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              LOCKED APPLICATIONS
            </Text>

            {trackedApps.map((app, appIdx) => {
              const percent = Math.min(
                100,
                Math.round((app.usedTodayMs / app.dailyLimitMs) * 100)
              );
              const shadeColor = getDynamicMonochromeShade(appIdx, trackedApps.length, isDark);

              return (
                <Card
                  key={app.packageName}
                  variant={app.isLocked ? "locked" : "default"}
                  className="flex-col gap-2.5 p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      {app.iconBase64 ? (
                        <Image
                          source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                          className="w-10 h-10 rounded-lg"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-white/10 items-center justify-center border border-primary/20 dark:border-white/20">
                          <Text className="font-bold text-sm text-primary dark:text-white">
                            {app.appName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5"
                      >
                        {app.appName}
                      </Text>
                    </View>

                    <StatusPill isLocked={app.isLocked} />
                  </View>

                  <View className="flex-col gap-1.5 w-full mt-1">
                    <View className="flex-row justify-between items-end">
                      <Text className="font-bold text-xs text-secondary dark:text-zinc-300">
                        {formatMs(app.usedTodayMs)} / {formatMs(app.dailyLimitMs)} limit
                      </Text>
                      <Text className="font-bold text-xs text-primary dark:text-white">
                        {percent}%
                      </Text>
                    </View>

                    <ProgressBar progressPercent={percent} isLocked={app.isLocked} />
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
        className="absolute bottom-20 right-6 w-14 h-14 bg-primary dark:bg-white rounded-full items-center justify-center z-40 border-2 border-primary dark:border-white shadow-none active:scale-95"
      >
        <Plus size={28} color={fabIconColor} />
      </TouchableOpacity>

      <BottomNavBar />
    </View>
  );
};
