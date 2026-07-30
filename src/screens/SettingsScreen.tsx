import React from "react";
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { NativeBridge } from "../services/nativeBridge";
import { Moon, Sun, Monitor, ShieldCheck, Info, Lock } from "lucide-react-native";

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateThemeMode,
    trackedApps,
    permissions,
    setCurrentScreen,
    effectiveTheme,
  } = useApp();

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";

  const themeOptions: Array<{ mode: "system" | "light" | "dark"; label: string; icon: any }> = [
    { mode: "system", label: "SYSTEM", icon: Monitor },
    { mode: "light", label: "LIGHT", icon: Sun },
    { mode: "dark", label: "DARK", icon: Moon },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-black">
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

        {/* Section 2: Manage Tracked Apps (View Only) */}
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
              <Card key={app.packageName} className="flex-row justify-between items-center py-3">
                <Text className="font-bold text-sm text-primary dark:text-white">
                  {app.appName}
                </Text>
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

        {/* Section 3: Permissions Status */}
        <View className="flex-col gap-3 mb-8">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            PERMISSIONS STATUS
          </Text>

          <TouchableOpacity
            onPress={() => setCurrentScreen("permissions")}
            className="border-2 border-primary dark:border-white bg-surface-container-lowest dark:bg-zinc-900 p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <ShieldCheck size={22} color={iconColor} />
              <View className="flex-col">
                <Text className="font-bold text-sm uppercase text-primary dark:text-white">
                  SYSTEM PERMISSIONS
                </Text>
                <Text className="text-xs text-secondary dark:text-zinc-400">
                  {permissions.usageStats && permissions.overlay && permissions.accessibility
                    ? "ALL 3 PERMISSIONS GRANTED"
                    : "ACTION REQUIRED — TAP TO REVIEW"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 4: About Blackout */}
        <View className="flex-col gap-3 mb-8">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            ABOUT BLACKOUT
          </Text>

          <Card className="flex-col gap-2">
            <View className="flex-row items-center gap-2">
              <Info size={18} color={iconColor} />
              <Text className="font-bold text-sm text-primary dark:text-white uppercase">
                BLACKOUT V1.0.0
              </Text>
            </View>
            <Text className="text-xs text-secondary dark:text-zinc-400 leading-relaxed">
              Blackout is an offline, zero-telemetry Android digital wellbeing tool designed for uncompromised cognitive focus.
            </Text>
          </Card>
        </View>
      </ScrollView>

      <BottomNavBar />
    </SafeAreaView>
  );
};
