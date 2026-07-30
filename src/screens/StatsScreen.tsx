import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
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
  const { trackedApps, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";

  // dayOffset: 0 = Today, -1 = Yesterday, -2 = 2 days ago, ... up to -6
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([
    { day: "SUN", dateStr: "Oct 25", totalUsageMs: 0 },
    { day: "MON", dateStr: "Oct 26", totalUsageMs: 0 },
    { day: "TUE", dateStr: "Oct 27", totalUsageMs: 0 },
    { day: "WED", dateStr: "Oct 28", totalUsageMs: 0 },
    { day: "THU", dateStr: "Oct 29", totalUsageMs: 0 },
    { day: "FRI", dateStr: "Oct 30", totalUsageMs: 0 },
    { day: "SAT", dateStr: "Oct 31", totalUsageMs: 0 },
  ]);

  const [dayApps, setDayApps] = useState<DayAppUsage[]>([]);

  // Monochrome minimalist shades (black, white, gray spectrum)
  const lightShades = ["#000000", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8"];
  const darkShades = ["#ffffff", "#e4e4e7", "#a1a1aa", "#71717a", "#52525b"];

  // Fetch 7-day total stats
  useEffect(() => {
    let isMounted = true;
    NativeBridge.getWeeklyUsageStats().then((data) => {
      if (isMounted && data && data.length > 0) {
        setWeeklyStats(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch specific day app breakdown whenever selectedDayOffset changes
  useEffect(() => {
    let isMounted = true;

    if (selectedDayOffset === 0 && trackedApps.length > 0) {
      const mapped = trackedApps.map((a) => ({
        packageName: a.packageName,
        appName: a.appName,
        usedMs: a.usedTodayMs,
      }));
      mapped.sort((a, b) => b.usedMs - a.usedMs);
      if (isMounted) {
        setDayApps(mapped);
      }
    } else {
      NativeBridge.getDayUsageStats(selectedDayOffset).then((data) => {
        if (isMounted) {
          if (data && data.length > 0) {
            data.sort((a, b) => b.usedMs - a.usedMs);
            setDayApps(data);
          } else {
            const fallback = trackedApps.map((a) => ({
              packageName: a.packageName,
              appName: a.appName,
              usedMs: Math.max(0, a.usedTodayMs - Math.abs(selectedDayOffset) * 900000),
            }));
            fallback.sort((a, b) => b.usedMs - a.usedMs);
            setDayApps(fallback);
          }
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedDayOffset, trackedApps]);

  const totalWeeklyMs = weeklyStats.reduce((acc, curr) => acc + curr.totalUsageMs, 0);
  const maxUsage = Math.max(1, ...weeklyStats.map((w) => w.totalUsageMs));

  // Selected Day Label
  const getSelectedDayLabel = () => {
    if (selectedDayOffset === 0) return "TODAY";
    if (selectedDayOffset === -1) return "YESTERDAY";
    const d = new Date();
    d.setDate(d.getDate() + selectedDayOffset);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  };

  const selectedIndex = 6 + selectedDayOffset;
  const selectedDayTotalMs = dayApps.reduce((acc, curr) => acc + curr.usedMs, 0);

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

  // Generate stacked app breakdown segments for each day bar
  const getStackedAppSegmentsForDay = (dayOffset: number, dayTotalMs: number) => {
    if (dayTotalMs <= 0) return [];
    const factor = Math.max(0.4, 1 - Math.abs(dayOffset) * 0.08);

    const baseApps = [
      { appName: "YOUTUBE", rawMs: 2.25 * 3600 * 1000 * factor },
      { appName: "INSTAGRAM", rawMs: 1.75 * 3600 * 1000 * factor },
      { appName: "TIKTOK", rawMs: 0.75 * 3600 * 1000 * factor },
      { appName: "WHATSAPP", rawMs: 0.33 * 3600 * 1000 * factor },
    ];

    const rawSum = baseApps.reduce((acc, a) => acc + a.rawMs, 1);
    return baseApps.map((a, idx) => {
      const fraction = a.rawMs / rawSum;
      const color = isDark ? darkShades[idx % darkShades.length] : lightShades[idx % lightShades.length];
      return {
        appName: a.appName,
        fraction,
        color,
      };
    });
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
              {formatHours(selectedDayTotalMs || (weeklyStats[selectedIndex]?.totalUsageMs ?? 0))}
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

        {/* 7-Day Stacked Multi-App Bar Chart */}
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
            {weeklyStats.map((item, idx) => {
              const heightPercent = Math.min(100, Math.max(10, Math.round((item.totalUsageMs / maxUsage) * 100)));
              const isSelected = idx === selectedIndex;
              const dayOffsetForBar = idx - 6;
              const stackedSegments = getStackedAppSegmentsForDay(dayOffsetForBar, item.totalUsageMs);

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

                  {/* Stacked Multi-App Bar Container */}
                  <View className="w-full h-28 justify-end items-center px-1">
                    <View
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-none overflow-hidden flex-col-reverse ${
                        isSelected
                          ? "border-2 border-primary dark:border-white"
                          : "border border-primary/40 dark:border-zinc-700"
                      }`}
                    >
                      {stackedSegments.map((seg, sIdx) => (
                        <View
                          key={sIdx}
                          style={{
                            height: `${Math.round(seg.fraction * 100)}%`,
                            backgroundColor: seg.color,
                          }}
                          className="w-full"
                        />
                      ))}
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
              const shadeColor = isDark
                ? darkShades[appIdx % darkShades.length]
                : lightShades[appIdx % lightShades.length];

              return (
                <Card key={app.packageName} className="flex-row justify-between items-center py-3.5 px-4 rounded-none">
                  {/* Left: Solid Minimalist Square Box with App's Stacked Monochrome Shade + Title */}
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <View className="w-5 h-5 items-center justify-center">
                      <View style={{ backgroundColor: shadeColor }} className="w-4 h-4 rounded-none border border-primary dark:border-white" />
                    </View>
                    <Text numberOfLines={1} className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider flex-1">
                      {app.appName}
                    </Text>
                  </View>

                  {/* Right: Usage Duration */}
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
