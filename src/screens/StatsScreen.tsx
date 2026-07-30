import React from "react";
import { View, Text, SafeAreaView, ScrollView } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { WeeklyStats } from "../types";

export const StatsScreen: React.FC = () => {
  const { trackedApps } = useApp();

  const dummyWeekly: WeeklyStats[] = [
    { day: "MON", dateStr: "Oct 20", totalUsageMs: 2.5 * 3600 * 1000 },
    { day: "TUE", dateStr: "Oct 21", totalUsageMs: 1.8 * 3600 * 1000 },
    { day: "WED", dateStr: "Oct 22", totalUsageMs: 3.2 * 3600 * 1000 },
    { day: "THU", dateStr: "Oct 23", totalUsageMs: 1.2 * 3600 * 1000 },
    { day: "FRI", dateStr: "Oct 24", totalUsageMs: 2.8 * 3600 * 1000 },
    { day: "SAT", dateStr: "Oct 25", totalUsageMs: 4.0 * 3600 * 1000 },
    { day: "SUN", dateStr: "Oct 26", totalUsageMs: 1.5 * 3600 * 1000 },
  ];

  const maxUsage = Math.max(...dummyWeekly.map((w) => w.totalUsageMs));

  const formatHours = (ms: number) => {
    return (ms / (1000 * 3600)).toFixed(1) + "h";
  };

  const totalWeeklyMs = dummyWeekly.reduce((acc, curr) => acc + curr.totalUsageMs, 0);

  return (
    <View className="flex-1 bg-background dark:bg-black">
      <NavigationHeader title="STATS" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="px-margin-page pt-4 flex-1">
        <View className="flex-col gap-1 mb-6">
          <Text className="font-bold text-3xl text-primary dark:text-white uppercase tracking-tight">
            WEEKLY DIGEST
          </Text>
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            OCT 20 - OCT 26
          </Text>
        </View>

        {/* Weekly Summary Card */}
        <Card className="flex-row justify-around items-center py-6 mb-6">
          <View className="flex-col items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase">
              TOTAL USAGE
            </Text>
            <Text className="font-bold text-3xl text-primary dark:text-white mt-1">
              {formatHours(totalWeeklyMs)}
            </Text>
          </View>

          <View className="w-[1px] h-10 bg-primary dark:bg-white" />

          <View className="flex-col items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase">
              DAILY AVG
            </Text>
            <Text className="font-bold text-3xl text-primary dark:text-white mt-1">
              {formatHours(totalWeeklyMs / 7)}
            </Text>
          </View>
        </Card>

        {/* Bar Chart */}
        <Card className="p-4 mb-6">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase mb-6 tracking-widest">
            DAILY APP USAGE DURATION
          </Text>

          <View className="flex-row justify-between items-end h-40 pt-4 px-2">
            {dummyWeekly.map((item) => {
              const heightPercent = Math.round((item.totalUsageMs / maxUsage) * 100);

              return (
                <View key={item.day} className="flex-col items-center gap-2 flex-1">
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

        {/* Per-App Totals */}
        <View className="flex-col gap-3">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            TODAY'S APP BREAKDOWN
          </Text>

          {trackedApps.length === 0 ? (
            <Card className="py-6 items-center">
              <Text className="text-sm font-bold text-secondary dark:text-zinc-400 uppercase">
                No apps tracked today
              </Text>
            </Card>
          ) : (
            trackedApps.map((app) => (
              <Card key={app.packageName} className="flex-row justify-between items-center py-3">
                <Text className="font-bold text-base text-primary dark:text-white">
                  {app.appName}
                </Text>
                <Text className="font-bold text-sm text-secondary dark:text-zinc-300">
                  {formatHours(app.usedTodayMs)} used
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
