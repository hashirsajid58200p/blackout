import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
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
      title: "USAGE ACCESS",
      description: "Reads daily app usage duration",
      icon: Eye,
      isGranted: isUsageStatsGranted,
      onGrant: handleGrantUsageStats,
    },
    {
      id: "overlay",
      title: "DRAW OVER APPS",
      description: "Displays full-screen blackout overlay",
      icon: AppWindow,
      isGranted: isOverlayGranted,
      onGrant: handleGrantOverlay,
    },
    {
      id: "accessibility",
      title: "ACCESSIBILITY SERVICE",
      description: "Detects locked foreground app instantly",
      icon: CircleAlert,
      isGranted: isAccessibilityGranted,
      onGrant: handleGrantAccessibility,
    },
  ];

  return (
    <View className="flex-1 bg-background dark:bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }} className="flex-1 px-margin-page pt-6">
        <View className="items-center justify-center my-auto py-2">
          {/* Top Logo */}
          <View className="mb-4 border-2 border-primary dark:border-white p-3.5 justify-center items-center">
            <Shield size={44} color={iconColor} />
          </View>

          {/* Heading */}
          <Text className="font-bold text-2xl text-primary dark:text-white uppercase tracking-tight text-center mb-1.5">
            REQUIRED PERMISSIONS
          </Text>

          {/* Paragraph */}
          <Text className="text-xs text-secondary dark:text-zinc-400 text-center mb-5 max-w-[290px] leading-5">
            To detect locked apps in real-time and block them instantly, Blackout requires system privileges.
          </Text>

          {/* Permission Cards */}
          <View className="w-full flex-col gap-2.5 mb-5">
            {permissionItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <View
                  key={item.id}
                  className="border-2 border-primary dark:border-white p-3 rounded-none flex-col bg-surface-container-lowest dark:bg-zinc-900"
                >
                  {/* 1. Top Row: Icon Center-Aligned Vertically with Heading Text Line */}
                  <View className="flex-row items-center gap-2.5 mb-1">
                    <View className="w-5 h-5 items-center justify-center">
                      <IconComponent size={20} color={iconColor} />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="font-bold text-sm uppercase tracking-wider text-primary dark:text-white flex-1 leading-5"
                    >
                      {item.title}
                    </Text>
                  </View>

                  {/* 2. Description Paragraph: Left-aligned at exact 30px offset */}
                  <Text className="text-xs text-secondary dark:text-zinc-400 ml-[30px] leading-4 mb-1.5">
                    {item.description}
                  </Text>

                  {/* 3. Action Button: Aligned on the Right Side */}
                  <View className="flex-row justify-end">
                    {item.isGranted ? (
                      <View className="bg-primary dark:bg-white px-2.5 py-1 flex-row items-center justify-center gap-1 border border-primary dark:border-white min-w-[76px]">
                        <CheckCircle2 size={12} color={badgeIconColor} />
                        <Text className="text-xs font-bold text-white dark:text-black uppercase">
                          GRANTED
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={item.onGrant}
                        className="bg-transparent border-2 border-primary dark:border-white px-2.5 py-1 items-center justify-center min-w-[76px] active:bg-primary/10 dark:active:bg-white/10"
                      >
                        <Text className="text-xs font-bold text-primary dark:text-white uppercase">
                          GRANT
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Main Action Button */}
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

          <Text className="text-xs text-secondary dark:text-zinc-500 max-w-[260px] text-center pt-3 leading-4">
            Blackout operates completely offline. No usage data ever leaves your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
