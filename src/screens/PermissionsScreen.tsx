import React, { useEffect, useState } from "react";
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useApp } from "../context/AppContext";
import { NativeBridge } from "../services/nativeBridge";
import { Button } from "../components/ui/Button";
import { Shield, CheckCircle2, CircleAlert, AppWindow, Eye } from "lucide-react-native";

export const PermissionsScreen: React.FC = () => {
  const { permissions, refreshPermissions, setCurrentScreen, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";
  const badgeIconColor = isDark ? "#000000" : "#ffffff";

  // Dev state override for testing in Expo Go
  const [devGranted, setDevGranted] = useState({
    usageStats: false,
    overlay: false,
    accessibility: false,
  });

  useEffect(() => {
    refreshPermissions();
    const interval = setInterval(() => {
      refreshPermissions();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshPermissions]);

  const isUsageStatsGranted = permissions.usageStats || devGranted.usageStats;
  const isOverlayGranted = permissions.overlay || devGranted.overlay;
  const isAccessibilityGranted = permissions.accessibility || devGranted.accessibility;

  const allGranted = isUsageStatsGranted && isOverlayGranted && isAccessibilityGranted;

  const handleGrantUsageStats = () => {
    NativeBridge.openUsageStatsSettings();
    setDevGranted((prev) => ({ ...prev, usageStats: true }));
  };

  const handleGrantOverlay = () => {
    NativeBridge.openOverlaySettings();
    setDevGranted((prev) => ({ ...prev, overlay: true }));
  };

  const handleGrantAccessibility = () => {
    NativeBridge.openAccessibilitySettings();
    setDevGranted((prev) => ({ ...prev, accessibility: true }));
  };

  const permissionItems = [
    {
      id: "usageStats",
      title: "Usage Access",
      description: "Reads daily app usage duration",
      icon: Eye,
      isGranted: isUsageStatsGranted,
      onGrant: handleGrantUsageStats,
    },
    {
      id: "overlay",
      title: "Draw Over Apps",
      description: "Displays full-screen blackout overlay",
      icon: AppWindow,
      isGranted: isOverlayGranted,
      onGrant: handleGrantOverlay,
    },
    {
      id: "accessibility",
      title: "Accessibility Service",
      description: "Detects locked foreground app instantly",
      icon: CircleAlert,
      isGranted: isAccessibilityGranted,
      onGrant: handleGrantAccessibility,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} className="flex-1 px-margin-page pt-6">
        <View className="items-center justify-center my-auto py-6">
          <View className="mb-6 border-2 border-primary dark:border-white p-4 justify-center items-center">
            <Shield size={48} color={iconColor} />
          </View>

          <Text className="font-bold text-2xl text-primary dark:text-white uppercase tracking-tight text-center mb-2">
            REQUIRED PERMISSIONS
          </Text>

          <Text className="text-xs text-secondary dark:text-zinc-400 text-center mb-8 max-w-[290px] leading-5">
            To detect locked apps in real-time and block them instantly, Blackout requires system privileges.
          </Text>

          <View className="w-full flex-col gap-4 mb-8">
            {permissionItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <View
                  key={item.id}
                  className="border-2 border-primary dark:border-white p-4 rounded-none flex-row items-center justify-between bg-surface-container-lowest dark:bg-zinc-900"
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <View className="w-7 h-7 items-center justify-center">
                      <IconComponent size={20} color={iconColor} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-sm uppercase text-primary dark:text-white">
                        {item.title}
                      </Text>
                      <Text className="text-xs text-secondary dark:text-zinc-400 mt-0.5">
                        {item.description}
                      </Text>
                    </View>
                  </View>

                  {item.isGranted ? (
                    <View className="bg-primary dark:bg-white px-3 py-1.5 flex-row items-center justify-center gap-1.5 border border-primary dark:border-white min-w-[92px]">
                      <CheckCircle2 size={13} color={badgeIconColor} />
                      <Text className="text-xs font-bold text-white dark:text-black uppercase">
                        GRANTED
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={item.onGrant}
                      className="bg-transparent border-2 border-primary dark:border-white px-3 py-1.5 items-center justify-center min-w-[92px] active:bg-primary/10 dark:active:bg-white/10"
                    >
                      <Text className="text-xs font-bold text-primary dark:text-white uppercase">
                        GRANT
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <Button
            label={allGranted ? "ENTER BLACKOUT" : "GRANT PERMISSIONS"}
            onPress={() => {
              if (allGranted) {
                setCurrentScreen("home");
              } else {
                if (!isUsageStatsGranted) handleGrantUsageStats();
                else if (!isOverlayGranted) handleGrantOverlay();
                else if (!isAccessibilityGranted) handleGrantAccessibility();
              }
            }}
          />

          <Text className="text-xs text-secondary dark:text-zinc-500 max-w-[260px] text-center pt-4 leading-4">
            Blackout operates completely offline. No usage data ever leaves your device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
