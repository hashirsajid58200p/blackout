import React, { useEffect } from "react";
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useApp } from "../context/AppContext";
import { NativeBridge } from "../services/nativeBridge";
import { Button } from "../components/ui/Button";
import { Shield, CheckCircle2, CircleAlert, AppWindow, Eye } from "lucide-react-native";

export const PermissionsScreen: React.FC = () => {
  const { permissions, refreshPermissions, setCurrentScreen } = useApp();

  useEffect(() => {
    const interval = setInterval(() => {
      refreshPermissions();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshPermissions]);

  const allGranted =
    permissions.usageStats && permissions.overlay && permissions.accessibility;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-black p-margin-page">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="items-center text-center my-auto py-8">
          <View className="mb-6 text-primary dark:text-white border-2 border-primary dark:border-white p-4">
            <Shield size={56} color="#000000" className="dark:text-white" />
          </View>

          <Text className="font-bold text-3xl text-primary dark:text-white uppercase tracking-tight text-center mb-2">
            REQUIRED PERMISSIONS
          </Text>

          <Text className="text-base text-secondary dark:text-zinc-300 text-center mb-8 max-w-[280px]">
            To detect locked apps in real-time and block them instantly, Blackout requires system privileges.
          </Text>

          <View className="w-full flex-col gap-4 mb-8">
            {/* 1. Usage Stats Permission */}
            <View className="border-2 border-primary dark:border-white p-4 rounded-lg flex-row items-center justify-between bg-surface-container-lowest dark:bg-zinc-900">
              <View className="flex-row items-center gap-3 flex-1">
                <Eye size={24} color="#000000" className="dark:text-white" />
                <View className="flex-1">
                  <Text className="font-bold text-sm uppercase text-primary dark:text-white">
                    Usage Access
                  </Text>
                  <Text className="text-xs text-secondary dark:text-zinc-400">
                    Reads daily app usage duration
                  </Text>
                </View>
              </View>

              {permissions.usageStats ? (
                <View className="flex-row items-center gap-1 bg-primary dark:bg-white px-2 py-1">
                  <CheckCircle2 size={14} color="#ffffff" className="dark:text-black" />
                  <Text className="text-xs font-bold text-white dark:text-black uppercase">
                    Granted
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => NativeBridge.openUsageStatsSettings()}
                  className="bg-transparent border border-primary dark:border-white px-3 py-1"
                >
                  <Text className="text-xs font-bold text-primary dark:text-white uppercase">
                    Enable
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 2. System Alert Window Overlay */}
            <View className="border-2 border-primary dark:border-white p-4 rounded-lg flex-row items-center justify-between bg-surface-container-lowest dark:bg-zinc-900">
              <View className="flex-row items-center gap-3 flex-1">
                <AppWindow size={24} color="#000000" className="dark:text-white" />
                <View className="flex-1">
                  <Text className="font-bold text-sm uppercase text-primary dark:text-white">
                    Draw Over Apps
                  </Text>
                  <Text className="text-xs text-secondary dark:text-zinc-400">
                    Displays full-screen blackout overlay
                  </Text>
                </View>
              </View>

              {permissions.overlay ? (
                <View className="flex-row items-center gap-1 bg-primary dark:bg-white px-2 py-1">
                  <CheckCircle2 size={14} color="#ffffff" className="dark:text-black" />
                  <Text className="text-xs font-bold text-white dark:text-black uppercase">
                    Granted
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => NativeBridge.openOverlaySettings()}
                  className="bg-transparent border border-primary dark:border-white px-3 py-1"
                >
                  <Text className="text-xs font-bold text-primary dark:text-white uppercase">
                    Enable
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Accessibility Service */}
            <View className="border-2 border-primary dark:border-white p-4 rounded-lg flex-row items-center justify-between bg-surface-container-lowest dark:bg-zinc-900">
              <View className="flex-row items-center gap-3 flex-1">
                <CircleAlert size={24} color="#000000" className="dark:text-white" />
                <View className="flex-1">
                  <Text className="font-bold text-sm uppercase text-primary dark:text-white">
                    Accessibility Service
                  </Text>
                  <Text className="text-xs text-secondary dark:text-zinc-400">
                    Detects locked foreground app instantly
                  </Text>
                </View>
              </View>

              {permissions.accessibility ? (
                <View className="flex-row items-center gap-1 bg-primary dark:bg-white px-2 py-1">
                  <CheckCircle2 size={14} color="#ffffff" className="dark:text-black" />
                  <Text className="text-xs font-bold text-white dark:text-black uppercase">
                    Granted
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => NativeBridge.openAccessibilitySettings()}
                  className="bg-transparent border border-primary dark:border-white px-3 py-1"
                >
                  <Text className="text-xs font-bold text-primary dark:text-white uppercase">
                    Enable
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Button
            label={allGranted ? "ENTER BLACKOUT" : "GRANT PERMISSIONS"}
            onPress={() => {
              if (allGranted) {
                setCurrentScreen("home");
              } else {
                if (!permissions.usageStats) NativeBridge.openUsageStatsSettings();
                else if (!permissions.overlay) NativeBridge.openOverlaySettings();
                else if (!permissions.accessibility) NativeBridge.openAccessibilitySettings();
              }
            }}
          />

          <Text className="text-xs text-outline dark:text-zinc-500 max-w-[240px] text-center pt-4">
            Blackout operates completely offline. No usage data ever leaves your device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
