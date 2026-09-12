import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { Modal } from "../components/ui/Modal";
import { NativeBridge } from "../services/nativeBridge";
import { Search, Check } from "lucide-react-native";
import { InstalledAppInfo } from "../types";
import { HapticsService } from "../services/haptics";

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

const CATEGORIES = ["ALL", "SOCIAL", "GAMES", "MEDIA", "BROWSERS"];

export const AddAppScreen: React.FC = () => {
  const { trackedApps, addTrackedApp, setCurrentScreen, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";

  const [appsList, setAppsList] = useState<InstalledAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedApp, setSelectedApp] = useState<InstalledAppInfo | null>(null);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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
    let isMounted = true;
    NativeBridge.getInstalledApps()
      .then((apps) => {
        if (isMounted) {
          setAppsList(apps);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredApps = appsList.filter((app) => {
    const matchesSearch =
      app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === "ALL") return true;

    const cat = (app.category || "").toUpperCase();
    if (selectedCategory === "SOCIAL") {
      return (
        cat === "SOCIAL" ||
        app.packageName.includes("whatsapp") ||
        app.packageName.includes("instagram") ||
        app.packageName.includes("twitter") ||
        app.packageName.includes("facebook") ||
        app.packageName.includes("snapchat") ||
        app.packageName.includes("tiktok") ||
        app.packageName.includes("telegram")
      );
    }
    if (selectedCategory === "GAMES") {
      return cat === "GAMES" || app.packageName.includes("game");
    }
    if (selectedCategory === "MEDIA") {
      return (
        cat === "MEDIA" ||
        app.packageName.includes("youtube") ||
        app.packageName.includes("netflix") ||
        app.packageName.includes("spotify")
      );
    }
    if (selectedCategory === "BROWSERS") {
      return (
        cat === "BROWSERS" ||
        app.packageName.includes("chrome") ||
        app.packageName.includes("firefox") ||
        app.packageName.includes("browser")
      );
    }
    return cat === selectedCategory;
  });

  const handleSetTimer = () => {
    HapticsService.tick();
    if (!selectedApp) {
      setDialogConfig({
        visible: true,
        title: "SELECT AN APP",
        description: "Please select an installed application to set a daily limit.",
        variant: "warning",
        singleButton: true,
        confirmLabel: "ACKNOWLEDGE",
        onCancel: closeDialog,
      });
      return;
    }
    const totalMs = (hours * 3600 + minutes * 60) * 1000;
    if (totalMs < 60000) {
      setDialogConfig({
        visible: true,
        title: "INVALID LIMIT",
        description: "Daily limit must be at least 1 minute.",
        variant: "warning",
        singleButton: true,
        confirmLabel: "ACKNOWLEDGE",
        onCancel: closeDialog,
      });
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmLock = async () => {
    if (!selectedApp) return;
    HapticsService.stamp();
    const totalMs = (hours * 3600 + minutes * 60) * 1000;
    const res = await addTrackedApp(
      selectedApp.packageName,
      selectedApp.appName,
      totalMs,
      selectedApp.category,
      undefined,
      selectedApp.iconBase64,
      selectedApp.iconUri
    );

    setShowConfirmModal(false);
    if (res.success) {
      setCurrentScreen("home");
    } else {
      setDialogConfig({
        visible: true,
        title: "ERROR",
        description: res.error || "Could not set lock.",
        variant: "danger",
        singleButton: true,
        confirmLabel: "DISMISS",
        onCancel: closeDialog,
      });
    }
  };

  return (
    <View className="flex-1 bg-paper dark:bg-espresso">
      <NavigationHeader title="SET TIMER" showBack />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 60 }}
        className="px-margin-page pt-4 flex-1"
      >
        {/* Step 1: Search & Pick App */}
        <View className="flex-col gap-2 mb-3">
          <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
            STEP 1 — SELECT TARGET APPLICATION
          </Text>
          <View className="flex-row items-center border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded-none px-3 h-11">
            <Search size={16} color={iconColor} strokeWidth={1.25} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="SEARCH INSTALLED APPS..."
              placeholderTextColor={isDark ? "#8C93A6" : "#5C6478"}
              className="flex-1 font-mono text-xs text-ink dark:text-bone py-2 px-2"
            />
          </View>
        </View>

        {/* Category Filter Chips */}
        <View className="flex-row flex-wrap gap-1.5 mb-4">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.7}
                onPress={() => {
                  HapticsService.tick();
                  setSelectedCategory(cat);
                }}
                className={`py-1 px-2.5 border rounded-none items-center justify-center ${
                  isSelected
                    ? "border-ink dark:border-bone bg-ink dark:bg-bone"
                    : "border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface active:bg-ink/5 dark:active:bg-bone/5"
                }`}
              >
                <Text
                  className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                    isSelected
                      ? "text-paper dark:text-espresso font-mono-bold"
                      : "text-ink dark:text-bone"
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View className="py-12 items-center justify-center flex-col gap-3">
            <ActivityIndicator size="large" color={isDark ? "#E6E8EC" : "#1A2030"} />
            <Text className="font-body-bold text-xs text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
              SCANNING INSTALLED APPS...
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-2 mb-8">
            {filteredApps.map((app) => {
              const trackedApp = trackedApps.find(
                (ta) => ta.packageName === app.packageName
              );
              const isAlreadyTracked = !!trackedApp;
              const isSelected = selectedApp?.packageName === app.packageName;

              return (
                <View key={app.packageName} className="flex-col">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={isAlreadyTracked}
                    onPress={() => {
                      HapticsService.tick();
                      setSelectedApp(app);
                    }}
                    className={`p-3.5 border rounded-none flex-col gap-1 ${
                      isAlreadyTracked
                        ? "border-hairline/50 dark:border-hairline-dark/50 opacity-40 bg-paper-surface/50 dark:bg-espresso-surface/50"
                        : isSelected
                        ? "border-ink dark:border-bone bg-paper-surface dark:bg-espresso-surface"
                        : "border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface"
                    }`}
                  >
                    {/* App Row: Icon + Column (Title & Subtitle) + Selection/Lock Status */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3 flex-1 pr-2">
                        <View className="w-9 h-9 items-center justify-center">
                          {app.iconUri ? (
                            <Image
                              source={{ uri: app.iconUri }}
                              className="w-9 h-9 rounded-none"
                              resizeMode="contain"
                            />
                          ) : app.iconBase64 ? (
                            <Image
                              source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                              className="w-9 h-9 rounded-none"
                              resizeMode="contain"
                            />
                          ) : (
                            <View className="w-9 h-9 rounded-none bg-paper dark:bg-espresso border border-hairline dark:border-hairline-dark items-center justify-center">
                              <Text className="font-display text-sm font-bold text-ink dark:text-bone">
                                {app.appName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            className="font-body-bold text-sm text-ink dark:text-bone leading-5"
                          >
                            {app.appName}
                          </Text>
                          <Text className="font-mono text-xs text-ink-muted dark:text-bone-muted mt-0.5">
                            {(() => {
                              if (!app.usedTodayMs || app.usedTodayMs <= 0) return "No usage today";
                              const minutes = Math.floor(app.usedTodayMs / (1000 * 60));
                              const hours = Math.floor(minutes / 60);
                              const minsRem = minutes % 60;
                              if (hours > 0) {
                                return `Used for ${hours}h ${minsRem}m today`;
                              }
                              return `Used for ${minsRem}m today`;
                            })()}
                          </Text>
                        </View>
                      </View>

                      {isAlreadyTracked && trackedApp ? (
                        <Text
                          className={`text-[10px] font-mono-bold uppercase tracking-[0.1em] ${
                            trackedApp.isLocked ? "text-stamp-red" : "text-brass dark:text-brass"
                          }`}
                        >
                          {trackedApp.isLocked ? "LOCKED TODAY" : "TRACKED TODAY"}
                        </Text>
                      ) : isSelected ? (
                        <View className="w-5 h-5 rounded-none bg-ink dark:bg-bone items-center justify-center">
                          <Check size={11} color={isDark ? "#12161F" : "#E6E8EC"} strokeWidth={1.5} />
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* Step 2: Time Selector directly beneath the selected app */}
                  {isSelected && (
                    <View className="flex-col gap-4 mt-2 mb-2 border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface rounded-none">
                      <Text className="font-body-bold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
                        STEP 2 — SET DAILY ALLOWANCE
                      </Text>

                      {/* Quick Presets */}
                      <View className="flex-col gap-1.5">
                        <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
                          QUICK PRESETS
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {[
                            { label: "15M", h: 0, m: 15 },
                            { label: "30M", h: 0, m: 30 },
                            { label: "45M", h: 0, m: 45 },
                            { label: "1H", h: 1, m: 0 },
                            { label: "2H", h: 2, m: 0 },
                            { label: "3H", h: 3, m: 0 },
                          ].map((preset) => {
                            const isCurrent = hours === preset.h && minutes === preset.m;
                            return (
                              <TouchableOpacity
                                key={preset.label}
                                activeOpacity={0.7}
                                onPress={() => {
                                  HapticsService.tick();
                                  setHours(preset.h);
                                  setMinutes(preset.m);
                                }}
                                className={`py-1.5 px-3 border rounded-none items-center justify-center ${
                                  isCurrent
                                    ? "border-ink dark:border-bone bg-ink dark:bg-bone"
                                    : "border-hairline dark:border-hairline-dark bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                                }`}
                              >
                                <Text
                                  className={`font-mono text-xs uppercase ${
                                    isCurrent
                                      ? "text-paper dark:text-espresso font-mono-bold"
                                      : "text-ink dark:text-bone"
                                  }`}
                                >
                                  {preset.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Responsive Time Pickers Row */}
                      <View className="flex-row items-center justify-center gap-3 py-2">
                        {/* Hours Picker Column */}
                        <View className="flex-col items-center flex-1">
                          <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase mb-2 tracking-[0.12em]">
                            HOURS
                          </Text>
                          <View className="flex-row items-center gap-1.5">
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                HapticsService.tick();
                                setHours(Math.max(0, hours - 1));
                              }}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded-none items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">-</Text>
                            </TouchableOpacity>
                            <Text className="font-mono-bold text-2xl text-ink dark:text-bone min-w-[36px] text-center">
                              {hours}
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                HapticsService.tick();
                                setHours(Math.min(12, hours + 1));
                              }}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded-none items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View className="flex-col items-center justify-center">
                          <Text className="text-[10px] font-body-bold opacity-0 mb-2"> </Text>
                          <View className="h-8 items-center justify-center">
                            <Text className="font-mono-bold text-2xl text-ink dark:text-bone self-center leading-none">:</Text>
                          </View>
                        </View>

                        {/* Minutes Picker Column with +/- 1 Stepper */}
                        <View className="flex-col items-center flex-1">
                          <Text className="text-[10px] font-body-bold text-ink-muted dark:text-bone-muted uppercase mb-2 tracking-[0.12em]">
                            MINUTES
                          </Text>
                          <View className="flex-row items-center gap-1.5">
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                HapticsService.tick();
                                setMinutes(Math.max(0, minutes - 1));
                              }}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded-none items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">-</Text>
                            </TouchableOpacity>
                            <Text className="font-mono-bold text-2xl text-ink dark:text-bone min-w-[36px] text-center">
                              {String(minutes).padStart(2, "0")}
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                HapticsService.tick();
                                setMinutes(Math.min(59, minutes + 1));
                              }}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded-none items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Confirm Action Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSetTimer}
                        className="bg-ink dark:bg-bone border border-ink dark:border-bone py-3 px-4 rounded-none items-center justify-center mt-2 active:opacity-90"
                      >
                        <Text numberOfLines={1} className="font-body-bold text-xs text-paper dark:text-espresso uppercase tracking-[0.1em]">
                          LOCK IT IN — {app.appName.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Empty search fallback */}
            {filteredApps.length === 0 && searchQuery.trim().length > 0 && (
              <View className="p-6 border border-hairline dark:border-hairline-dark rounded-none bg-paper-surface dark:bg-espresso-surface items-center justify-center mt-4">
                <Text className="font-body text-xs text-ink-muted dark:text-bone-muted text-center uppercase tracking-[0.06em]">
                  No installed application matches "{searchQuery.trim()}"
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        title="CONFIRM LOCK"
        description={`Set a daily limit of ${hours}h ${minutes}m for ${selectedApp?.appName}?`}
        variant="warning"
        calloutText="This lock cannot be edited, paused, or undone today."
        calloutVariant="danger"
        confirmLabel="LOCK APPLICATION"
        cancelLabel="CANCEL"
        onConfirm={confirmLock}
        onCancel={() => setShowConfirmModal(false)}
      />

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
