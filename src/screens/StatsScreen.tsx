import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { NativeBridge } from "../services/nativeBridge";
import { WeeklyStats } from "../types";
import { BarChart2 } from "lucide-react-native";

export const StatsScreen: React.FC = () => {
  const { trackedApps, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";

  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([
    { day: "SUN", dateStr: "Day 1", totalUsageMs: 0 },
    { day: "MON", dateStr: "Day 2", totalUsageMs: 0 },
    { day: "TUE", dateStr: "Day 3", totalUsageMs: 0 },
    { day: "WED", dateStr: "Day 4", totalUsageMs: 0 },
    { day: "THU", dateStr: "Day 5", totalUsageMs: 0 },
    { day: "FRI", dateStr: "Day 6", totalUsageMs: 0 },
    { day: "SAT", dateStr: "Day 7", totalUsageMs: 0 },
  ]);

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

  const totalWeeklyMs = weeklyStats.reduce((acc, curr) => acc + curr.totalUsageMs, 0);
  const maxUsage = Math.max(1, ...weeklyStats.map((w) => w.totalUsageMs));

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
        <View className="flex-col gap-1 mb-6">
          <Text className="font-bold text-3xl text-primary dark:text-white uppercase tracking-tight">
            WEEKLY DIGEST
          </Text>
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            REAL DEVICE USAGE METRICS
          </Text>
        </View>

        {/* Weekly Summary Card */}
        <Card className="flex-row justify-around items-center py-6 mb-6 rounded-none">
          <View className="flex-col items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              TOTAL USAGE
            </Text>
            <Text className="font-bold text-3xl text-primary dark:text-white mt-1">
              {formatHours(totalWeeklyMs)}
            </Text>
          </View>

          <View className="w-[1.5px] h-10 bg-primary dark:bg-white" />

          <View className="flex-col items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              DAILY AVG
            </Text>
            <Text className="font-bold text-3xl text-primary dark:text-white mt-1">
              {formatHours(totalWeeklyMs / 7)}
            </Text>
          </View>
        </Card>

        {/* Bar Chart */}
        <Card className="p-4 mb-6 rounded-none flex-col">
          <View className="flex-row items-center gap-2.5 mb-6">
            <View className="w-5 h-5 items-center justify-center">
              <BarChart2 size={20} color={iconColor} />
            </View>
            <Text className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider leading-5">
              7-DAY USAGE DURATION
            </Text>
          </View>

          <View className="flex-row justify-between items-end h-40 pt-4 px-2">
            {weeklyStats.map((item, idx) => {
              const heightPercent = Math.min(100, Math.max(8, Math.round((item.totalUsageMs / maxUsage) * 100)));

              return (
                <View key={idx} className="flex-col items-center gap-2 flex-1">
                  <View className="w-full h-32 justify-end items-center px-1">
                    <View
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-primary dark:bg-white rounded-none border border-primary dark:border-white"
                    />
                  </View>
                  <Text className="font-bold text-xs text-primary dark:text-white">
                    {item.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Today's Per-App Breakdown */}
        <View className="flex-col gap-3">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            TODAY'S REAL APP BREAKDOWN
          </Text>

          {trackedApps.length === 0 ? (
            <Card className="py-6 items-center">
              <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase">
                No app locks active today
              </Text>
            </Card>
          ) : (
            trackedApps.map((app) => (
              <Card key={app.packageName} className="flex-row justify-between items-center py-3.5 px-4 rounded-none">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="w-5 h-5 items-center justify-center">
                    <View className="w-4 h-4 bg-primary dark:bg-white rounded-none" />
                  </View>
                  <Text numberOfLines={1} className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider">
                    {app.appName}
                  </Text>
                </View>
                <Text className="font-bold text-xs text-secondary dark:text-zinc-300 uppercase">
                  {formatMs(app.usedTodayMs)} used
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
};
