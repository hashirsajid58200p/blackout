import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { Moon, Sun, Monitor, ShieldCheck, Info, Lock, Trash2 } from "lucide-react-native";

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateThemeMode,
    updateAutoCleanSetting,
    trackedApps,
    permissions,
    setCurrentScreen,
    effectiveTheme,
  } = useApp();

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";
  const isAutoCleanEnabled = settings.autoCleanUninstalled !== false;

  const themeOptions: Array<{ mode: "system" | "light" | "dark"; label: string; icon: any }> = [
    { mode: "system", label: "SYSTEM", icon: Monitor },
    { mode: "light", label: "LIGHT", icon: Sun },
    { mode: "dark", label: "DARK", icon: Moon },
  ];

  return (
    <View className="flex-1 bg-background dark:bg-black">
      <NavigationHeader title="SETTINGS" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="px-margin-page pt-4 flex-1">
        {/* Section 1: Appearance / Theme */}
        <View className="flex-col gap-3 mb-8">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            THEME MODE
          </Text>

          <View className="flex-row gap-2">
            {themeOptions.map((item) => {
              const IconComp = item.icon;
              const isSelected = settings.themeMode === item.mode;
              const buttonIconColor = isSelected
                ? isDark
                  ? "#000000"
                  : "#ffffff"
                : isDark
                ? "#ffffff"
                : "#000000";

              return (
                <TouchableOpacity
                  key={item.mode}
                  activeOpacity={0.8}
                  onPress={() => updateThemeMode(item.mode)}
                  className={`flex-1 p-4 border-2 flex-col items-center gap-2 ${
                    isSelected
                      ? "border-primary bg-primary dark:bg-white dark:border-white"
                      : "border-primary dark:border-white bg-surface-container-lowest dark:bg-black"
                  }`}
                >
                  <IconComp size={22} color={buttonIconColor} />
                  <Text
                    className={`font-bold text-xs uppercase ${
                      isSelected
                        ? "text-white dark:text-black"
                        : "text-primary dark:text-white"
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 2: Auto-Clean Feature */}
        <View className="flex-col gap-3 mb-8">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            AUTOMATION & CLEANUP
          </Text>

          <View className="border-2 border-primary dark:border-white p-4 bg-surface-container-lowest dark:bg-black flex-col rounded-none">
            {/* Top Row: Icon Center-Aligned Vertically with Heading */}
            <View className="flex-row items-center gap-2.5 mb-1.5">
              <View className="w-5 h-5 items-center justify-center">
                <Trash2 size={20} color={iconColor} />
              </View>
              <Text
                numberOfLines={1}
                className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5"
              >
                AUTO-REMOVE UNINSTALLED APPS
              </Text>
            </View>

            {/* Description Paragraph: Full-width aligned */}
            <Text className="text-xs text-secondary dark:text-zinc-400 leading-4 mb-3">
              Automatically delete app lock profiles if the app is uninstalled from your phone
            </Text>

            {/* Action Button: Aligned on the Right Side */}
            <View className="flex-row justify-end">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => updateAutoCleanSetting(!isAutoCleanEnabled)}
                className={`px-3 py-1.5 border-2 border-primary dark:border-white ${
                  isAutoCleanEnabled ? "bg-primary dark:bg-white" : "bg-transparent"
                }`}
              >
                <Text
                  className={`font-bold text-xs uppercase ${
                    isAutoCleanEnabled
                      ? "text-white dark:text-black"
                      : "text-primary dark:text-white"
                  }`}
                >
                  {isAutoCleanEnabled ? "ENABLED" : "DISABLED"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 3: Manage Tracked Apps (View Only) */}
        <View className="flex-col gap-3 mb-8">
          <View className="flex-row justify-between items-center">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              ACTIVE TODAY'S LOCKS (VIEW ONLY)
            </Text>
            <Lock size={14} color={isDark ? "#a3a3a3" : "#7e7576"} />
          </View>

          {trackedApps.length === 0 ? (
            <Card className="py-4 items-center">
              <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase">
                No active locks configured
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
                <Text className="text-xs font-bold uppercase text-secondary dark:text-zinc-400">
                  {Math.round(app.dailyLimitMs / (1000 * 60))}m daily limit
                </Text>
              </Card>
            ))
          )}

          <Text className="text-xs text-secondary dark:text-zinc-500 italic">
            Note: In accordance with Blackout rules, active daily limits cannot be paused, edited, or deleted until midnight.
          </Text>
        </View>

        {/* Section 4: Permissions Status */}
        <View className="flex-col gap-3 mb-8">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            PERMISSIONS STATUS
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCurrentScreen("permissions")}
            className="border-2 border-primary dark:border-white bg-surface-container-lowest dark:bg-black p-4 flex-col rounded-none"
          >
            <View className="flex-row items-center gap-2.5 mb-1.5">
              <View className="w-5 h-5 items-center justify-center">
                <ShieldCheck size={20} color={iconColor} />
              </View>
              <Text
                numberOfLines={1}
                className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5"
              >
                SYSTEM PERMISSIONS
              </Text>
            </View>
            <Text className="text-xs text-secondary dark:text-zinc-400 ml-[30px] leading-4">
              {permissions.usageStats && permissions.overlay && permissions.accessibility
                ? "ALL 3 PERMISSIONS GRANTED"
                : "ACTION REQUIRED — TAP TO REVIEW"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 5: About Blackout */}
        <View className="flex-col gap-3 mb-8">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            ABOUT BLACKOUT
          </Text>

          <Card className="flex-col p-4 rounded-none">
            <View className="flex-row items-center gap-2.5 mb-1.5">
              <View className="w-5 h-5 items-center justify-center">
                <Info size={20} color={iconColor} />
              </View>
              <Text className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider leading-5">
                BLACKOUT V1.0.0
              </Text>
            </View>
            <Text className="text-xs text-secondary dark:text-zinc-400 ml-[30px] leading-relaxed">
              Blackout is an offline, zero-telemetry Android digital wellbeing tool designed for uncompromised cognitive focus.
            </Text>
          </Card>
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
};
