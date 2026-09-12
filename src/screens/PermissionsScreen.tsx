import React, { useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Platform, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { NativeBridge } from "../services/nativeBridge";
import { Button } from "../components/ui/Button";
import { Shield, CheckCircle2, CircleAlert, AppWindow, Eye, Lock } from "lucide-react-native";

export const PermissionsScreen: React.FC = () => {
  const { permissions, refreshPermissions, setCurrentScreen, effectiveTheme } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";

  const topPadding =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight || 0) + 12
      : Math.max(insets.top, 16);

  useEffect(() => {
    refreshPermissions();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshPermissions();
      }
    });

    const interval = setInterval(() => {
      refreshPermissions();
    }, 1500);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [refreshPermissions]);

  const isUsageStatsGranted = permissions.usageStats;
  const isOverlayGranted = permissions.overlay;
  const isAccessibilityGranted = permissions.accessibility;
  const isDeviceAdminGranted = permissions.deviceAdmin;

  const allGranted = isUsageStatsGranted && isOverlayGranted && isAccessibilityGranted && isDeviceAdminGranted;

  const handleGrantUsageStats = () => {
    NativeBridge.openUsageStatsSettings();
  };

  const handleGrantOverlay = () => {
    NativeBridge.openOverlaySettings();
  };

  const handleGrantAccessibility = () => {
    NativeBridge.openAccessibilitySettings();
  };

  const handleGrantDeviceAdmin = () => {
    NativeBridge.requestDeviceAdmin();
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
    {
      id: "deviceAdmin",
      title: "DEVICE ADMINISTRATOR",
      description: "Prevents unauthorized uninstallation of Blackout",
      icon: Lock,
      isGranted: isDeviceAdminGranted,
      onGrant: handleGrantDeviceAdmin,
    },
  ];

  return (
    <View style={{ paddingTop: topPadding }} className="flex-1 bg-paper dark:bg-espresso">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }} className="flex-1 px-margin-page pt-6">
        <View className="items-center justify-center my-auto py-2">
          {/* Top Logo */}
          <View className="mb-4 border border-hairline dark:border-hairline-dark rounded w-14 h-14 bg-paper-surface dark:bg-espresso-surface justify-center items-center">
            <Shield size={28} color={iconColor} strokeWidth={1.25} />
          </View>

          {/* Heading */}
          <Text className="font-display text-2xl text-ink dark:text-bone tracking-tight text-center mb-1.5">
            Required Permissions
          </Text>

          {/* Paragraph */}
          <Text className="font-body text-xs text-ink-muted dark:text-bone-muted text-center mb-5 max-w-[290px] leading-5">
            To detect locked apps in real-time and block them instantly, Blackout requires system privileges.
          </Text>

          {/* Permission Cards */}
          <View className="w-full flex-col gap-2.5 mb-5">
            {permissionItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <View
                  key={item.id}
                  className="border border-hairline dark:border-hairline-dark p-3.5 rounded flex-col bg-paper-surface dark:bg-espresso-surface"
                >
                  {/* Content Row: Icon aligned with Title + Description column */}
                  <View className="flex-row items-start gap-2.5 mb-2">
                    <View className="w-5 h-5 items-center justify-center mt-0.5 shrink-0">
                      <IconComponent
                        size={18}
                        color={item.isGranted ? "#4F7566" : iconColor}
                        strokeWidth={1.25}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className="font-body-semibold text-xs uppercase tracking-widest text-ink dark:text-bone leading-5"
                      >
                        {item.title}
                      </Text>
                      <Text className="font-body text-xs text-ink-muted dark:text-bone-muted leading-4 mt-0.5">
                        {item.description}
                      </Text>
                    </View>
                  </View>

                  {/* 3. Action Button: Aligned on the Right Side */}
                  <View className="flex-row justify-end">
                    {item.isGranted ? (
                      <View className="bg-stamp-olive/10 border border-stamp-olive px-2.5 py-1 rounded-sm flex-row items-center justify-center gap-1.5 min-w-[76px]">
                        <CheckCircle2 size={11} color="#4F7566" strokeWidth={1.25} />
                        <Text className="text-[10px] font-mono-bold text-stamp-olive uppercase tracking-wider">
                          GRANTED
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={item.onGrant}
                        className="bg-transparent border border-hairline dark:border-hairline-dark px-2.5 py-1 rounded items-center justify-center min-w-[76px] active:bg-ink/5 dark:active:bg-bone/5"
                      >
                        <Text className="text-[10px] font-body-semibold text-ink dark:text-bone uppercase tracking-widest">
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
                else if (!isDeviceAdminGranted) handleGrantDeviceAdmin();
              }
            }}
          />

          <Text className="font-body text-xs text-ink-muted dark:text-bone-muted max-w-[270px] text-center pt-3 leading-4">
            Blackout operates completely offline. No usage data ever leaves your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
