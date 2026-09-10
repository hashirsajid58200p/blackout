import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
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
  const iconColor = isDark ? "#ffffff" : "#000000";

  // dayOffset: 0 = Today, -1 = Yesterday, -2 = 2 days ago, ... up to -6
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [historicalDayApps, setHistoricalDayApps] = useState<DayAppUsage[]>([]);

  useEffect(() => {
    refreshUsageStats();
  }, [refreshUsageStats]);

  // Dynamic continuous monochrome lightness generator
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
    ? todayDeviceUsage.map((d) => ({ packageName: d.packageName, appName: d.appName, usedMs: d.usedMs }))
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
    <View className="flex-1 bg-background dark:bg-black">
      <NavigationHeader title="STATS" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="px-margin-page pt-4 flex-1">
        {/* Title: Single Line */}
        <Text numberOfLines={1} className="font-bold text-3xl text-primary dark:text-white uppercase tracking-tight mb-3">
          SCREEN TIME
        </Text>

        {/* Date Selector Carousel */}
        <View className="flex-row items-center justify-between border-2 border-primary dark:border-white p-2 bg-surface-container-lowest dark:bg-black rounded-none mb-6">
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={selectedDayOffset <= -6}
            onPress={() => setSelectedDayOffset((prev) => Math.max(-6, prev - 1))}
            className={`p-2 border border-primary dark:border-white min-w-[36px] items-center justify-center ${
              selectedDayOffset <= -6 ? "opacity-20" : "active:bg-primary/10"
            }`}
          >
            <ChevronLeft size={18} color={iconColor} />
          </TouchableOpacity>

          <View className="flex-col items-center">
            <Text className="font-bold text-sm uppercase text-primary dark:text-white tracking-widest">
              {getSelectedDayLabel()}
            </Text>
            <Text className="text-[10px] font-bold text-secondary dark:text-zinc-400 uppercase tracking-widest mt-0.5">
              {selectedDayOffset === 0 ? "CURRENT DATE" : "HISTORICAL RECORD"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={selectedDayOffset >= 0}
            onPress={() => setSelectedDayOffset((prev) => Math.min(0, prev + 1))}
            className={`p-2 border border-primary dark:border-white min-w-[36px] items-center justify-center ${
              selectedDayOffset >= 0 ? "opacity-20" : "active:bg-primary/10"
            }`}
          >
            <ChevronRight size={18} color={iconColor} />
          </TouchableOpacity>
        </View>

        {/* Selected Day Summary Card */}
        <Card className="flex-row justify-around items-center py-5 mb-6 rounded-none">
          <View className="flex-col items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              {getSelectedDayLabel()} TOTAL
            </Text>
            <Text className="font-bold text-3xl text-primary dark:text-white mt-1">
              {formatHours(selectedDayTotalMs)}
            </Text>
          </View>

          <View className="w-[1.5px] h-10 bg-primary dark:bg-white" />

          <View className="flex-col items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              7-DAY AVG
            </Text>
            <Text className="font-bold text-3xl text-primary dark:text-white mt-1">
              {formatHours(totalWeeklyMs / 7)}
            </Text>
          </View>
        </Card>

        {/* 7-Day Smooth Vertical Gradient Blending Bar Chart */}
        <Card className="p-4 mb-6 rounded-none flex-col">
          <View className="flex-row items-center gap-2.5 mb-4">
            <View className="w-5 h-5 items-center justify-center">
              <BarChart2 size={20} color={iconColor} />
            </View>
            <Text className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider leading-5">
              LAST 7 DAYS TRACKER
            </Text>
          </View>

          <View className="flex-row justify-between items-end h-44 pt-2 px-1">
            {activeWeeklyStats.map((item, idx) => {
              const heightPercent = Math.min(100, Math.max(10, Math.round((item.totalUsageMs / maxUsage) * 100)));
              const isSelected = idx === selectedIndex;
              const dayOffsetForBar = idx - 6;

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => setSelectedDayOffset(dayOffsetForBar)}
                  className="flex-col items-center gap-1.5 flex-1"
                >
                  {/* Usage duration above each bar */}
                  <Text className={`text-[10px] font-bold ${isSelected ? "text-primary dark:text-white" : "text-secondary dark:text-zinc-500"}`}>
                    {formatHours(item.totalUsageMs)}
                  </Text>

                  {/* Smooth Vertical Gradient Blending Bar */}
                  <View className="w-full h-28 justify-end items-center px-1">
                    <View
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-none overflow-hidden ${
                        isSelected
                          ? "border-2 border-primary dark:border-white"
                          : "border border-primary/40 dark:border-zinc-700"
                      }`}
                    >
                      <Svg width="100%" height="100%" preserveAspectRatio="none">
                        <Defs>
                          <LinearGradient id={`smoothBarGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={isDark ? "#71717a" : "#d4d4d8"} />
                            <Stop offset="50%" stopColor={isDark ? "#d4d4d8" : "#3f3f46"} />
                            <Stop offset="100%" stopColor={isDark ? "#ffffff" : "#000000"} />
                          </LinearGradient>
                        </Defs>
                        <Rect
                          x="0"
                          y="0"
                          width="100%"
                          height="100%"
                          fill={`url(#smoothBarGrad-${idx})`}
                        />
                      </Svg>
                    </View>
                  </View>
                  <Text
                    className={`font-bold text-xs ${
                      isSelected ? "text-primary dark:text-white underline" : "text-secondary dark:text-zinc-400"
                    }`}
                  >
                    {item.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Sorted App Usage Breakdown */}
        <View className="flex-col gap-3">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            {getSelectedDayLabel()} APP USAGE (MOST USED TOP)
          </Text>

          {dayApps.length === 0 ? (
            <Card className="py-6 items-center">
              <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase">
                No app usage recorded for this date
              </Text>
            </Card>
          ) : (
            dayApps.map((app, appIdx) => {
              const shadeColor = getDynamicMonochromeShade(appIdx, dayApps.length, isDark);

              return (
                <Card key={app.packageName} className="flex-row justify-between items-center py-3.5 px-4 rounded-none">
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <View className="w-5 h-5 items-center justify-center">
                      <View style={{ backgroundColor: shadeColor }} className="w-4 h-4 rounded-none border border-primary dark:border-white" />
                    </View>
                    <Text numberOfLines={1} className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider flex-1">
                      {app.appName}
                    </Text>
                  </View>

                  <Text className="font-bold text-xs text-primary dark:text-white uppercase">
                    {formatMs(app.usedMs)} USED
                  </Text>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
};
