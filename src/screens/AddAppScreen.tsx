import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { NativeBridge } from "../services/nativeBridge";
import { Search, Check, Plus } from "lucide-react-native";
import { InstalledAppInfo } from "../types";

export const AddAppScreen: React.FC = () => {
  const { trackedApps, addTrackedApp, setCurrentScreen, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#EDE4D3" : "#2B2621";

  const [appsList, setAppsList] = useState<InstalledAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<InstalledAppInfo | null>(null);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const filteredApps = appsList.filter((app) =>
    app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSetTimer = () => {
    if (!selectedApp) {
      Alert.alert("Select an App", "Please pick an app to lock.");
      return;
    }
    const totalMs = (hours * 3600 + minutes * 60) * 1000;
    if (totalMs < 60000) {
      Alert.alert("Invalid Limit", "Daily limit must be at least 1 minute.");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmLock = async () => {
    if (!selectedApp) return;
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
      Alert.alert("Error", res.error || "Could not set lock.");
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
        <View className="flex-col gap-2 mb-4">
          <Text className="font-body-semibold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-widest">
            STEP 1 — SELECT TARGET APPLICATION
          </Text>
          <View className="flex-row items-center border border-hairline dark:border-hairline-dark bg-paper-surface dark:bg-espresso-surface rounded px-3 h-11">
            <Search size={18} color={iconColor} strokeWidth={1.25} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="SEARCH INSTALLED APPS..."
              placeholderTextColor={isDark ? "#A89A85" : "#6E6459"}
              className="flex-1 ml-2.5 font-body text-sm text-ink dark:text-bone uppercase"
            />
          </View>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View className="py-12 items-center justify-center flex-col gap-3">
            <ActivityIndicator size="large" color={isDark ? "#EDE4D3" : "#2B2621"} />
            <Text className="font-body-semibold text-xs text-ink-muted dark:text-bone-muted uppercase tracking-wider">
              SCANNING INSTALLED APPS...
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-2 mb-8">
            {filteredApps.map((app) => {
              const isAlreadyTracked = trackedApps.some(
                (ta) => ta.packageName === app.packageName
              );
              const isSelected = selectedApp?.packageName === app.packageName;

              return (
                <View key={app.packageName} className="flex-col">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={isAlreadyTracked}
                    onPress={() => setSelectedApp(app)}
                    className={`p-3.5 border rounded flex-col gap-1 ${
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
                              className="w-9 h-9 rounded border border-hairline dark:border-hairline-dark"
                              resizeMode="cover"
                            />
                          ) : app.iconBase64 ? (
                            <Image
                              source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                              className="w-9 h-9 rounded border border-hairline dark:border-hairline-dark"
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="w-9 h-9 rounded bg-paper dark:bg-espresso border border-hairline dark:border-hairline-dark items-center justify-center">
                              <Text className="font-display text-sm font-bold text-ink dark:text-bone">
                                {app.appName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            className="font-body-semibold text-sm text-ink dark:text-bone leading-5"
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

                      {isAlreadyTracked ? (
                        <Text className="text-[10px] font-mono-bold uppercase text-stamp-red tracking-wider">
                          LOCKED TODAY
                        </Text>
                      ) : isSelected ? (
                        <View className="w-5 h-5 rounded-full bg-ink dark:bg-bone items-center justify-center">
                          <Check size={11} color={isDark ? "#1B1712" : "#F4EFE4"} strokeWidth={2} />
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* Step 2: Time Selector directly beneath the selected app */}
                  {isSelected && (
                    <View className="flex-col gap-4 mt-2 mb-2 border border-hairline dark:border-hairline-dark p-4 bg-paper-surface dark:bg-espresso-surface rounded">
                      <Text className="font-body-semibold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-widest">
                        STEP 2 — SET DAILY ALLOWANCE
                      </Text>

                      {/* Responsive Time Pickers Row */}
                      <View className="flex-row items-center justify-center gap-3 py-2">
                        {/* Hours Picker Column */}
                        <View className="flex-col items-center flex-1">
                          <Text className="text-[10px] font-body-semibold text-ink-muted dark:text-bone-muted uppercase mb-2 tracking-widest">
                            HOURS
                          </Text>
                          <View className="flex-row items-center gap-1.5">
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setHours(Math.max(0, hours - 1))}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">-</Text>
                            </TouchableOpacity>
                            <Text className="font-mono-bold text-2xl text-ink dark:text-bone min-w-[36px] text-center">
                              {hours}
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setHours(Math.min(12, hours + 1))}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text className="font-mono-bold text-xl text-ink-muted dark:text-bone-muted self-end mb-1">:</Text>

                        {/* Minutes Picker Column with +/- 1 Stepper */}
                        <View className="flex-col items-center flex-1">
                          <Text className="text-[10px] font-body-semibold text-ink-muted dark:text-bone-muted uppercase mb-2 tracking-widest">
                            MINUTES
                          </Text>
                          <View className="flex-row items-center gap-1.5">
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setMinutes(Math.max(0, minutes - 1))}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
                            >
                              <Text className="font-mono-bold text-base text-ink dark:text-bone">-</Text>
                            </TouchableOpacity>
                            <Text className="font-mono-bold text-2xl text-ink dark:text-bone min-w-[36px] text-center">
                              {String(minutes).padStart(2, "0")}
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setMinutes(Math.min(59, minutes + 1))}
                              className="w-8 h-8 border border-hairline dark:border-hairline-dark rounded items-center justify-center bg-transparent active:bg-ink/5 dark:active:bg-bone/5"
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
                        className="bg-ink dark:bg-bone border border-ink dark:border-bone py-3 px-4 rounded items-center justify-center mt-2 active:opacity-90"
                      >
                        <Text numberOfLines={1} className="font-body-semibold text-xs text-paper dark:text-espresso uppercase tracking-widest">
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
              <View className="p-6 border border-hairline dark:border-hairline-dark rounded bg-paper-surface dark:bg-espresso-surface items-center justify-center mt-4">
                <Text className="font-body-medium text-xs text-ink-muted dark:text-bone-muted text-center uppercase tracking-wider">
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
        confirmLabel="LOCK APPLICATION"
        cancelLabel="CANCEL"
        onConfirm={confirmLock}
        onCancel={() => setShowConfirmModal(false)}
      />
    </View>
  );
};
