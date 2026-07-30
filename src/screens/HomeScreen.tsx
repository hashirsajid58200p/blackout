import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { StatusPill } from "../components/ui/StatusPill";
import { Plus, Camera, Video, MessageSquare, Globe, ShieldAlert } from "lucide-react-native";

export const HomeScreen: React.FC = () => {
  const { trackedApps, setCurrentScreen, permissions, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";
  const fabIconColor = isDark ? "#000000" : "#ffffff";

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

  const getIcon = (appName: string) => {
    const lower = appName.toLowerCase();
    if (lower.includes("insta") || lower.includes("camera") || lower.includes("photo"))
      return Camera;
    if (lower.includes("you") || lower.includes("video") || lower.includes("netf"))
      return Video;
    if (lower.includes("chat") || lower.includes("whats") || lower.includes("mess"))
      return MessageSquare;
    return Globe;
  };

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
        {(!permissions.usageStats || !permissions.overlay || !permissions.accessibility) && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCurrentScreen("permissions")}
            className="border-2 border-primary dark:border-white bg-surface-container dark:bg-zinc-900 p-4 mb-6 flex-col rounded-none"
          >
            <View className="flex-row items-center gap-2.5 mb-1">
              <View className="w-5 h-5 items-center justify-center">
                <ShieldAlert size={20} color={iconColor} />
              </View>
              <Text className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5">
                PERMISSIONS REQUIRED
              </Text>
            </View>
            <Text className="text-xs text-secondary dark:text-zinc-400 ml-[30px] leading-4">
              Tap to grant accessibility & overlay permissions
            </Text>
          </TouchableOpacity>
        )}

        {/* Tracked Apps List */}
        {trackedApps.length === 0 ? (
          <Card className="py-12 items-center justify-center text-center">
            <Text className="font-bold text-lg uppercase text-primary dark:text-white mb-2">
              NO APP LOCKS ACTIVE
            </Text>
            <Text className="text-sm text-secondary dark:text-zinc-400 text-center max-w-[240px]">
              Tap the (+) button below to pick an app and set a daily limit.
            </Text>
          </Card>
        ) : (
          <View className="flex-col gap-3.5">
            {trackedApps.map((app) => {
              const IconComp = getIcon(app.appName);
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
                  {/* Top Row: Icon Center-Aligned Vertically with App Name + StatusPill Right */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      <View className="w-5 h-5 items-center justify-center">
                        <View className="w-4 h-4 bg-primary dark:bg-white rounded-none" />
                      </View>
                      <Text
                        numberOfLines={1}
                        className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5"
                      >
                        {app.appName}
                      </Text>
                    </View>

                    <StatusPill isLocked={app.isLocked} />
                  </View>

                  {/* Progress Row: Aligned with left icon box */}
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
