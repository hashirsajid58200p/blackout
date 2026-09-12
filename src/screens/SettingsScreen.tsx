import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { BottomNavBar } from "../components/BottomNavBar";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { NativeBridge } from "../services/nativeBridge";
import { Moon, Sun, Monitor, ShieldCheck, Info, Lock, Trash2, ChevronRight } from "lucide-react-native";
import { TrackedApp } from "../types";
import { StorageService } from "../services/storage";

interface DialogConfig {
  visible: boolean;
  title: string;
  description: string;
  variant?: "default" | "danger" | "warning" | "info" | "success";
  calloutText?: string;
  calloutVariant?: "danger" | "warning" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  singleButton?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
}

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateThemeMode,
    updateAutoCleanSetting,
    trackedApps,
    permissions,
    setCurrentScreen,
    effectiveTheme,
    unlockTrackedApp,
    removeTrackedApp,
  } = useApp();

  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";
  const isAutoCleanEnabled = settings.autoCleanUninstalled !== false;

  const [isAdminActive, setIsAdminActive] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({
    visible: false,
    title: "",
    description: "",
    onCancel: () => {},
  });

  const closeDialog = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    NativeBridge.isDeviceAdminActive().then(setIsAdminActive);
  }, []);

  const handleRequestDeviceAdmin = async () => {
    await NativeBridge.requestDeviceAdmin();
    const active = await NativeBridge.isDeviceAdminActive();
    setIsAdminActive(active);
  };

  const handleUnlockPress = (app: TrackedApp) => {
    const now = Date.now();
    const expiration = app.lockExpirationTimestamp || StorageService.getNextMidnightTimestamp();
    if (app.isLocked) {
      if (now < expiration) {
        setDialogConfig({
          visible: true,
          title: "LOCK ACTIVE",
          description:
            "This application is currently locked and cannot be unlocked until midnight in accordance with Blackout rules.",
          variant: "danger",
          calloutText: "This lock cannot be edited, paused, or undone today.",
          calloutVariant: "danger",
          singleButton: true,
          confirmLabel: "ACKNOWLEDGE",
          onCancel: closeDialog,
        });
        return;
      }
      setDialogConfig({
        visible: true,
        title: "UNLOCK APPLICATION",
        description: `The lock period has completed. Restore normal access to ${app.appName}?`,
        variant: "info",
        confirmLabel: "UNLOCK",
        cancelLabel: "CANCEL",
        onConfirm: async () => {
          const res = await unlockTrackedApp(app.packageName);
          if (res.success) {
            setDialogConfig({
              visible: true,
              title: "UNLOCKED",
              description: `${app.appName} has been unlocked. Normal daily behavior restored.`,
              variant: "success",
              singleButton: true,
              confirmLabel: "DISMISS",
              onCancel: closeDialog,
            });
          } else {
            setDialogConfig({
              visible: true,
              title: "UNLOCK ERROR",
              description: res.error || "Could not unlock app.",
              variant: "danger",
              singleButton: true,
              confirmLabel: "DISMISS",
              onCancel: closeDialog,
            });
          }
        },
        onCancel: closeDialog,
      });
    } else {
      setDialogConfig({
        visible: true,
        title: "REMOVE APP LIMIT",
        description: `Stop tracking and remove daily limit for ${app.appName}? Normal access will no longer be restricted.`,
        variant: "danger",
        confirmLabel: "REMOVE LIMIT",
        cancelLabel: "KEEP TRACKING",
        calloutText: "Allowance and tracking history will be reset.",
        calloutVariant: "warning",
        onConfirm: async () => {
          const res = await removeTrackedApp(app.packageName);
          if (res.success) {
            closeDialog();
          } else {
            setDialogConfig({
              visible: true,
              title: "CANNOT REMOVE",
              description: res.error || "Could not remove app.",
              variant: "danger",
              singleButton: true,
              confirmLabel: "DISMISS",
              onCancel: closeDialog,
            });
          }
        },
        onCancel: closeDialog,
      });
    }
  };

  const themeOptions: Array<{ mode: "system" | "light" | "dark"; label: string; icon: any }> = [
    { mode: "system", label: "SYSTEM", icon: Monitor },
    { mode: "light", label: "LIGHT", icon: Sun },
    { mode: "dark", label: "DARK", icon: Moon },
  ];

  return (
    <View className="flex-1 bg-paper dark:bg-espresso">
      <NavigationHeader title="SETTINGS" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="px-margin-page pt-4 flex-1">
        {/* Title: Serif Display */}
        <Text numberOfLines={1} className="font-display text-3xl text-ink dark:text-bone tracking-tight mb-4">
          Preferences
        </Text>

        {/* Section 1: Appearance / Theme */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            THEME MODE
          </Text>

          <View className="flex-row gap-2">
            {themeOptions.map((item) => {
              const IconComp = item.icon;
              const isSelected = settings.themeMode === item.mode;
              const buttonIconColor = isSelected
                ? isDark
                  ? "#12161F"
                  : "#E6E8EC"
                : isDark
                ? "#E6E8EC"
                : "#1A2030";

              return (
                <TouchableOpacity
                  key={item.mode}
                  activeOpacity={0.7}
                  onPress={() => updateThemeMode(item.mode)}
                  className={`flex-1 py-3.5 px-2 border rounded-none flex-col items-center gap-2 ${
                    isSelected
                      ? "border-ink bg-ink dark:border-bone dark:bg-bone"
                      : "border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface active:bg-ink/5 dark:active:bg-bone/5"
                  }`}
                >
                  <IconComp size={18} strokeWidth={1.25} color={buttonIconColor} />
                  <Text
                    className={`font-body-bold text-xs uppercase tracking-[0.12em] ${
                      isSelected
                        ? "text-paper dark:text-espresso"
                        : "text-ink dark:text-bone"
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 2: Device Admin Uninstall Protection */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            UNINSTALL PROTECTION (DEVICE ADMIN)
          </Text>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center gap-2.5 mb-1.5">
              <ShieldCheck size={18} strokeWidth={1.25} color={iconColor} />
              <Text
                numberOfLines={1}
                className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone flex-1"
              >
                PREVENT UNINSTALLING
              </Text>
            </View>

            <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed mb-3">
              Activate Android Device Administrator privileges to prevent bypassing locked applications by removing Blackout.
            </Text>

            <View className="flex-row justify-end">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleRequestDeviceAdmin}
                className={`px-3 py-1.5 border rounded-none ${
                  isAdminActive
                    ? "bg-brass/15 border-brass/50 dark:border-brass/50"
                    : "border-hairline dark:border-hairline-dark bg-paper dark:bg-espresso active:bg-ink/5 dark:active:bg-bone/5"
                }`}
              >
                <Text
                  className={`font-body-bold text-xs uppercase tracking-[0.1em] ${
                    isAdminActive
                      ? "text-brass dark:text-brass"
                      : "text-ink dark:text-bone"
                  }`}
                >
                  {isAdminActive ? "PROTECTION ACTIVE" : "ACTIVATE ADMIN"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section: Auto-Clean Maintenance */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            MAINTENANCE
          </Text>

          <View className="border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface flex-col rounded-none">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center gap-2.5 mb-1.5">
                  <Trash2 size={18} strokeWidth={1.25} color={iconColor} />
                  <Text className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone">
                    AUTO-CLEAN UNINSTALLED APPS
                  </Text>
                </View>
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed">
                  Automatically purge tracked configurations when an application is uninstalled from Android.
                </Text>
              </View>

              {/* Mechanical Bracket Switch [ OFF | ON ] per DESIGN.md */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => updateAutoCleanSetting(!isAutoCleanEnabled)}
                className="flex-row items-center border border-hairline dark:border-hairline-dark rounded-none overflow-hidden self-center"
              >
                <View className={`px-2.5 py-1 ${!isAutoCleanEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${!isAutoCleanEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    OFF
                  </Text>
                </View>
                <View className="w-px h-full bg-hairline dark:bg-hairline-dark" />
                <View className={`px-2.5 py-1 ${isAutoCleanEnabled ? "bg-ink dark:bg-bone" : "bg-transparent"}`}>
                  <Text className={`font-mono-bold text-[10px] uppercase ${isAutoCleanEnabled ? "text-paper dark:text-espresso" : "text-ink-muted dark:text-bone-muted"}`}>
                    ON
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 3: Active Today's Locks (View Only) */}
        <View className="flex-col gap-2.5 mb-6">
          <View className="flex-row justify-between items-center px-1">
            <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              ACTIVE TODAY'S LOCKS
            </Text>
            <Lock size={14} strokeWidth={1.25} color={iconColor} />
          </View>

          {trackedApps.length === 0 ? (
            <Card className="py-4 items-center border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded-none">
              <Text className="font-body text-xs text-ink-muted dark:text-bone-muted uppercase">
                No active locks configured
              </Text>
            </Card>
          ) : (
            trackedApps.map((app) => (
              <TouchableOpacity
                key={app.packageName}
                activeOpacity={0.7}
                onPress={() => handleUnlockPress(app)}
                className="flex-row justify-between items-center py-3 px-3.5 border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded-none active:bg-ink/5 dark:active:bg-bone/5"
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  {app.iconUri ? (
                    <Image
                      source={{ uri: app.iconUri }}
                      className="w-7 h-7 rounded-none border border-hairline dark:border-hairline-dark"
                      resizeMode="cover"
                    />
                  ) : app.iconBase64 ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                      className="w-7 h-7 rounded-none border border-hairline dark:border-hairline-dark"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-7 h-7 bg-paper dark:bg-espresso border border-hairline dark:border-hairline-dark rounded-none items-center justify-center">
                      <Text className="font-display text-xs text-ink dark:text-bone font-bold">
                        {app.appName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text numberOfLines={1} className="font-body-bold text-sm text-ink dark:text-bone uppercase tracking-wider flex-1">
                    {app.appName}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className={`font-mono-bold text-[10px] uppercase tracking-[0.1em] ${app.isLocked ? "text-stamp-red" : "text-brass dark:text-brass"}`}>
                    {app.isLocked ? "LOCKED" : "RUNNING"}
                  </Text>
                  <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted uppercase">
                    • {Math.round(app.dailyLimitMs / (1000 * 60))}M
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text className="font-body italic text-xs text-ink-muted dark:text-bone-muted px-1 mt-1">
            Note: In accordance with Blackout rules, active daily limits cannot be paused, edited, or deleted until midnight.
          </Text>
        </View>

        {/* Section 4: Permissions Status */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            PERMISSIONS STATUS
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentScreen("permissions")}
            className="border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface p-4 flex-col rounded-none active:bg-ink/5 dark:active:bg-bone/5"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5 flex-1">
                <ShieldCheck size={18} strokeWidth={1.25} color={iconColor} />
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    className="font-body-bold text-sm uppercase tracking-[0.1em] text-ink dark:text-bone"
                  >
                    SYSTEM PERMISSIONS
                  </Text>
                  <Text className="font-body text-xs text-ink-muted dark:text-bone-muted mt-0.5">
                    {permissions.usageStats && permissions.overlay && permissions.accessibility && permissions.deviceAdmin
                      ? "ALL 4 PERMISSIONS GRANTED"
                      : "ACTION REQUIRED — TAP TO REVIEW"}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} strokeWidth={1.25} color={iconColor} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 5: About Blackout */}
        <View className="flex-col gap-2.5 mb-6">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em] px-1">
            ABOUT BLACKOUT
          </Text>

          <Card className="flex-col p-4 rounded-none border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface">
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center gap-2.5">
                <Info size={18} strokeWidth={1.25} color={iconColor} />
                <Text className="font-body-bold text-sm text-ink dark:text-bone uppercase tracking-[0.1em]">
                  BLACKOUT
                </Text>
              </View>
              <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted">
                v1.0.0
              </Text>
            </View>
            <Text className="font-body text-xs text-ink-muted dark:text-bone-muted ml-7 leading-relaxed">
              An analog-inspired, offline, zero-telemetry Android digital wellbeing utility engineered for uncompromised cognitive focus.
            </Text>
          </Card>
        </View>
      </ScrollView>

      <BottomNavBar />

      {dialogConfig.visible && (
        <Modal
          visible={dialogConfig.visible}
          title={dialogConfig.title}
          description={dialogConfig.description}
          variant={dialogConfig.variant}
          calloutText={dialogConfig.calloutText}
          calloutVariant={dialogConfig.calloutVariant}
          confirmLabel={dialogConfig.confirmLabel}
          cancelLabel={dialogConfig.cancelLabel}
          singleButton={dialogConfig.singleButton}
          onConfirm={dialogConfig.onConfirm}
          onCancel={dialogConfig.onCancel}
        />
      )}
    </View>
  );
};
