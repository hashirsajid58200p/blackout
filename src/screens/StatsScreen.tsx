import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { NativeBridge } from "../services/nativeBridge";
import { WeeklyStats } from "../types";
import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react-native";

interface DayAppUsage {
  packageName: string;
  appName: string;
  usedMs: number;
  iconBase64?: string;
  iconUri?: string;
}

export const StatsScreen: React.FC = () => {
  const {
    effectiveTheme,
    todayDeviceUsage,
    todayTotalUsageMs,
    weeklyUsageStats,
    refreshUsageStats,
  } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#EDE4D3" : "#2B2621";

  // dayOffset: 0 = Today, -1 = Yesterday, -2 = 2 days ago, ... up to -6
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [historicalDayApps, setHistoricalDayApps] = useState<DayAppUsage[]>([]);

  useEffect(() => {
    refreshUsageStats();
    const interval = setInterval(refreshUsageStats, 4000);
    return () => clearInterval(interval);
  }, [refreshUsageStats]);

  // Fetch specific historical day app breakdown if selectedDayOffset < 0
  useEffect(() => {
    if (selectedDayOffset === 0) {
      return;
    }

    let isMounted = true;
    NativeBridge.getDayUsageStats(selectedDayOffset).then((data) => {
      if (isMounted) {
        if (data && data.length > 0) {
          const sorted = [...data].sort((a, b) => b.usedMs - a.usedMs);
          setHistoricalDayApps(sorted);
        } else {
          setHistoricalDayApps([]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDayOffset]);

  // If today (0), consume unified state from AppContext
  const dayApps: DayAppUsage[] = selectedDayOffset === 0
    ? todayDeviceUsage.map((d) => ({
        packageName: d.packageName,
        appName: d.appName,
        usedMs: d.usedMs,
        iconUri: d.iconUri,
        iconBase64: d.iconBase64,
      }))
    : historicalDayApps;

  // Compute 7 days stats
  const activeWeeklyStats: WeeklyStats[] = weeklyUsageStats.length === 7
    ? weeklyUsageStats.map((item, idx) => {
        // Ensure today's bar (index 6) matches today's exact total
        if (idx === 6 && todayTotalUsageMs > 0) {
          return { ...item, totalUsageMs: todayTotalUsageMs };
        }
        return item;
      })
    : (() => {
        const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const fallback: WeeklyStats[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          fallback.push({
            day: dayNames[d.getDay()],
            dateStr: `${d.getMonth() + 1}/${d.getDate()}`,
            totalUsageMs: i === 0 ? todayTotalUsageMs : 0,
          });
        }
        return fallback;
      })();

  const totalWeeklyMs = activeWeeklyStats.reduce((acc, curr) => acc + curr.totalUsageMs, 0);
  const weeklyAverageMs = totalWeeklyMs / 7;
  const maxUsage = Math.max(1, ...activeWeeklyStats.map((w) => w.totalUsageMs));

  // Selected Day Label
  const getSelectedDayLabel = () => {
    if (selectedDayOffset === 0) return "TODAY";
    if (selectedDayOffset === -1) return "YESTERDAY";
    const d = new Date();
    d.setDate(d.getDate() + selectedDayOffset);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  };

  const selectedIndex = 6 + selectedDayOffset;
  const selectedDayTotalMs = selectedDayOffset === 0
    ? todayTotalUsageMs
    : dayApps.reduce((acc, curr) => acc + curr.usedMs, 0) || (activeWeeklyStats[selectedIndex]?.totalUsageMs ?? 0);

  const formatHours = (ms: number) => {
    const hours = (ms / (1000 * 3600)).toFixed(1);
    return `${hours}h`;
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

  return (
    <View className="flex-1 bg-paper dark:bg-espresso">
      <NavigationHeader title="STATS" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="px-margin-page pt-4 flex-1">
        {/* Title: Serif Display */}
        <Text numberOfLines={1} className="font-display font-semibold text-3xl text-ink dark:text-bone tracking-tight mb-3">
          Screen Time
        </Text>

        {/* Date Selector Carousel */}
        <View className="flex-row items-center justify-between border border-hairline dark:border-hairline-dark p-2 bg-paper-surface dark:bg-espresso-surface rounded mb-5">
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={selectedDayOffset <= -6}
            onPress={() => setSelectedDayOffset((prev) => Math.max(-6, prev - 1))}
            className={`w-9 h-9 border border-hairline dark:border-hairline-dark rounded items-center justify-center ${
              selectedDayOffset <= -6 ? "opacity-25" : "active:bg-ink/5 dark:active:bg-bone/5"
            }`}
          >
            <ChevronLeft size={16} strokeWidth={1.25} color={iconColor} />
          </TouchableOpacity>

          <View className="flex-col items-center">
            <Text className="font-body-semibold text-xs uppercase text-ink dark:text-bone tracking-widest">
              {getSelectedDayLabel()}
            </Text>
            <Text className="text-[10px] font-mono text-ink-muted dark:text-bone-muted uppercase tracking-wider mt-0.5">
              {selectedDayOffset === 0 ? "CURRENT RECORD" : "ARCHIVED LOG"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            disabled={selectedDayOffset >= 0}
            onPress={() => setSelectedDayOffset((prev) => Math.min(0, prev + 1))}
            className={`w-9 h-9 border border-hairline dark:border-hairline-dark rounded items-center justify-center ${
              selectedDayOffset >= 0 ? "opacity-25" : "active:bg-ink/5 dark:active:bg-bone/5"
            }`}
          >
            <ChevronRight size={16} strokeWidth={1.25} color={iconColor} />
          </TouchableOpacity>
        </View>

        {/* Selected Day Summary Card */}
        <Card className="flex-row justify-around items-center py-4 mb-5 rounded border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface">
          <View className="flex-col items-center">
            <Text className="font-body-semibold text-[10px] text-ink-muted dark:text-bone-muted uppercase tracking-widest">
              {getSelectedDayLabel()} TOTAL
            </Text>
            <Text className="font-mono-bold text-2xl text-ink dark:text-bone mt-1">
              {formatHours(selectedDayTotalMs)}
            </Text>
          </View>

          <View className="w-px h-10 bg-hairline dark:bg-hairline-dark" />

          <View className="flex-col items-center">
            <Text className="font-body-semibold text-[10px] text-ink-muted dark:text-bone-muted uppercase tracking-widest">
              7-DAY AVERAGE
            </Text>
            <Text className="font-mono-bold text-2xl text-ink dark:text-bone mt-1">
              {formatHours(weeklyAverageMs)}
            </Text>
          </View>
        </Card>

        {/* 7-Day Flat Hairline Bar Chart */}
        <Card className="p-4 mb-5 rounded border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface flex-col">
          <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-hairline dark:border-hairline-dark">
            <View className="flex-row items-center gap-2">
              <BarChart2 size={16} strokeWidth={1.25} color={iconColor} />
              <Text className="font-body-semibold text-xs text-ink dark:text-bone uppercase tracking-wider">
                7-Day Activity
              </Text>
            </View>
            <Text className="font-mono text-[10px] text-ink-muted dark:text-bone-muted uppercase">
              {formatHours(totalWeeklyMs)} TOTAL
            </Text>
          </View>

          <View className="flex-row justify-between items-end h-44 pt-2 px-1">
            {activeWeeklyStats.map((item, idx) => {
              const heightPercent = Math.min(100, Math.max(8, Math.round((item.totalUsageMs / maxUsage) * 100)));
              const isSelected = idx === selectedIndex;
              const dayOffsetForBar = idx - 6;
              const isOverAverage = item.totalUsageMs > weeklyAverageMs;

              let barBg = "bg-hairline/60 dark:bg-hairline-dark/80";
              let barBorder = "border-hairline dark:border-hairline-dark";

              if (isSelected) {
                if (isOverAverage) {
                  barBg = "bg-stamp-red";
                  barBorder = "border-stamp-red";
                } else {
                  barBg = "bg-stamp-olive";
                  barBorder = "border-stamp-olive";
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  onPress={() => setSelectedDayOffset(dayOffsetForBar)}
                  className="flex-col items-center gap-1.5 flex-1"
                >
                  {/* Usage duration above each bar */}
                  <Text className={`font-mono text-[10px] ${isSelected ? "font-mono-bold text-ink dark:text-bone" : "text-ink-muted dark:text-bone-muted"}`}>
                    {formatHours(item.totalUsageMs)}
                  </Text>

                  {/* Flat hairline-bordered bar */}
                  <View className="w-full h-28 justify-end items-center px-1">
                    <View
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-sm border ${barBg} ${barBorder}`}
                    />
                  </View>

                  {/* Day label */}
                  <View className="items-center">
                    <Text
                      className={`text-xs ${
                        isSelected ? "font-body-semibold text-ink dark:text-bone" : "font-body text-ink-muted dark:text-bone-muted"
                      }`}
                    >
                      {item.day}
                    </Text>
                    {isSelected && (
                      <View className="w-1 h-1 rounded-full bg-ink dark:bg-bone mt-0.5" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Sorted App Usage Breakdown */}
        <View className="flex-col gap-2.5">
          <Text className="font-body-semibold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-widest px-1">
            {getSelectedDayLabel()} APPLICATION BREAKDOWN
          </Text>

          {dayApps.length === 0 ? (
            <Card className="py-6 items-center border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded">
              <Text className="font-body text-xs text-ink-muted dark:text-bone-muted uppercase">
                No app usage recorded for this date
              </Text>
            </Card>
          ) : (
            dayApps.map((app) => {
              return (
                <View
                  key={app.packageName}
                  className="flex-row justify-between items-center py-3 px-3.5 border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded"
                >
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    {app.iconUri ? (
                      <Image
                        source={{ uri: app.iconUri }}
                        className="w-8 h-8 rounded border border-hairline dark:border-hairline-dark"
                        resizeMode="cover"
                      />
                    ) : app.iconBase64 ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                        className="w-8 h-8 rounded border border-hairline dark:border-hairline-dark"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-8 h-8 rounded border border-hairline dark:border-hairline-dark bg-paper dark:bg-espresso items-center justify-center">
                        <Text className="font-body-semibold text-xs text-ink-muted dark:text-bone-muted">
                          {app.appName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text numberOfLines={1} className="font-body-semibold text-sm text-ink dark:text-bone uppercase tracking-wide flex-1">
                      {app.appName}
                    </Text>
                  </View>

                  <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted uppercase">
                    {formatMs(app.usedMs)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
};
