import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { NativeBridge } from "../services/nativeBridge";
import { Search, Camera, Video, MessageSquare, Globe, Check, Plus, Gamepad2 } from "lucide-react-native";
import { InstalledAppInfo } from "../types";

export const AddAppScreen: React.FC = () => {
  const { trackedApps, addTrackedApp, setCurrentScreen, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";

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

  const getIcon = (appName: string) => {
    const lower = appName.toLowerCase();
    if (lower.includes("insta") || lower.includes("camera") || lower.includes("photo")) return Camera;
    if (lower.includes("you") || lower.includes("video") || lower.includes("netf") || lower.includes("tube"))
      return Video;
    if (lower.includes("chat") || lower.includes("snap") || lower.includes("mess") || lower.includes("what"))
      return MessageSquare;
    if (lower.includes("pubg") || lower.includes("game") || lower.includes("fire") || lower.includes("roblox"))
      return Gamepad2;
    return Globe;
  };

  const handleSelectCustomApp = () => {
    const cleanName = searchQuery.trim();
    if (!cleanName) return;
    const customPkg = "custom." + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const newCustomApp: InstalledAppInfo = {
      packageName: customPkg,
      appName: cleanName,
      category: "Custom Lock",
    };
    setSelectedApp(newCustomApp);
  };

  const handleSetTimer = () => {
    if (!selectedApp) {
      Alert.alert("Select an App", "Please pick an app to lock.");
      return;
    }
    const totalMs = (hours * 3600 + minutes * 60) * 1000;
    if (totalMs <= 0) {
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
      selectedApp.iconBase64
    );

    setShowConfirmModal(false);
    if (res.success) {
      setCurrentScreen("home");
    } else {
      Alert.alert("Error", res.error || "Could not set lock.");
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-black">
      <NavigationHeader title="SET TIMER" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} className="px-margin-page pt-4 flex-1">
        {/* Step 1: Search & Pick App */}
        <View className="flex-col gap-2 mb-4">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            STEP 1 — SELECT TARGET APPLICATION
          </Text>
          <View className="flex-row items-center border-2 border-primary dark:border-white bg-surface-container-lowest dark:bg-zinc-900 px-3 h-12">
            <Search size={20} color={iconColor} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="SEARCH INSTALLED APPS..."
              placeholderTextColor="#7e7576"
              className="flex-1 ml-3 font-bold text-sm text-primary dark:text-white uppercase"
            />
          </View>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View className="py-12 items-center justify-center flex-col gap-3">
            <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#000000"} />
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-wider">
              SCANNING INSTALLED APPS...
            </Text>
          </View>
        ) : (
          <View className="flex-col gap-2 mb-8">
            {filteredApps.map((app) => {
              const IconComp = getIcon(app.appName);
              const isAlreadyTracked = trackedApps.some(
                (ta) => ta.packageName === app.packageName
              );
              const isSelected = selectedApp?.packageName === app.packageName;

              return (
                <TouchableOpacity
                  key={app.packageName}
                  disabled={isAlreadyTracked}
                  onPress={() => setSelectedApp(app)}
                  className={`p-3.5 border-2 flex-col gap-1 ${
                    isAlreadyTracked
                      ? "border-outline opacity-40 bg-surface-container dark:bg-zinc-900"
                      : isSelected
                      ? "border-primary bg-primary dark:bg-white text-white"
                      : "border-primary dark:border-white bg-surface-container-lowest dark:bg-black"
                  }`}
                >
                  {/* Top Row: Icon Center-Aligned Vertically with App Name + Selection Indicator on Right */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      <View className="w-5 h-5 items-center justify-center">
                        <View
                          className={`w-4 h-4 rounded-none ${
                            isSelected
                              ? isDark
                                ? "bg-black"
                                : "bg-white"
                              : "bg-primary dark:bg-white"
                          }`}
                        />
                      </View>
                      <Text
                        numberOfLines={1}
                        className={`font-bold text-sm uppercase tracking-wider flex-1 leading-5 ${
                          isSelected
                            ? "text-white dark:text-black"
                            : "text-primary dark:text-white"
                        }`}
                      >
                        {app.appName}
                      </Text>
                    </View>

                    {isAlreadyTracked ? (
                      <Text className="text-xs font-bold uppercase text-secondary">
                        LOCKED TODAY
                      </Text>
                    ) : isSelected ? (
                      <View className="w-5 h-5 rounded-full bg-white dark:bg-black items-center justify-center">
                        <Check size={12} color={isDark ? "#ffffff" : "#000000"} />
                      </View>
                    ) : null}
                  </View>

                  {/* Category / Package Sub-text: Left-aligned at 30px offset */}
                  <Text
                    className={`text-xs ml-[30px] leading-4 ${
                      isSelected
                        ? "text-zinc-300 dark:text-zinc-700"
                        : "text-secondary dark:text-zinc-400"
                    }`}
                  >
                    {app.category || app.packageName}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom App Option when searching */}
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity
                onPress={handleSelectCustomApp}
                className="p-4 border-2 border-dashed border-primary dark:border-white bg-surface-container-lowest dark:bg-zinc-900 flex-row items-center gap-3 mt-2"
              >
                <Plus size={20} color={iconColor} />
                <View className="flex-col flex-1">
                  <Text className="font-bold text-sm text-primary dark:text-white uppercase">
                    ADD CUSTOM LOCK: "{searchQuery.trim()}"
                  </Text>
                  <Text className="text-xs text-secondary dark:text-zinc-400">
                    Set a daily limit for "{searchQuery.trim()}"
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2: Time Selector */}
        {selectedApp && (
          <View className="flex-col gap-4 mb-8 border-2 border-primary dark:border-white p-4 bg-surface-container-lowest dark:bg-zinc-900 rounded-none">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              STEP 2 — SET DAILY ALLOWANCE
            </Text>

            {/* Selected App Header */}
            <View className="flex-row items-center gap-2.5 pb-2 border-b border-primary/20 dark:border-white/20">
              <View className="w-5 h-5 items-center justify-center">
                <View className="w-4 h-4 bg-primary dark:bg-white rounded-none" />
              </View>
              <Text numberOfLines={1} className="font-bold text-sm text-primary dark:text-white uppercase tracking-wider flex-1">
                {selectedApp.appName}
              </Text>
            </View>

            {/* Responsive Time Pickers Row */}
            <View className="flex-row items-center justify-center gap-2 py-2">
              {/* Hours Picker Column */}
              <View className="flex-col items-center flex-1">
                <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase mb-2 tracking-widest">
                  HOURS
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setHours(Math.max(0, hours - 1))}
                    className="w-9 h-9 border-2 border-primary dark:border-white items-center justify-center bg-transparent active:bg-primary/10"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">-</Text>
                  </TouchableOpacity>
                  <Text className="font-bold text-2xl text-primary dark:text-white min-w-[32px] text-center">
                    {hours}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setHours(Math.min(12, hours + 1))}
                    className="w-9 h-9 border-2 border-primary dark:border-white items-center justify-center bg-transparent active:bg-primary/10"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text className="font-bold text-xl text-primary dark:text-white self-end mb-2">:</Text>

              {/* Minutes Picker Column */}
              <View className="flex-col items-center flex-1">
                <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase mb-2 tracking-widest">
                  MINUTES
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setMinutes(Math.max(0, minutes - 5))}
                    className="w-9 h-9 border-2 border-primary dark:border-white items-center justify-center bg-transparent active:bg-primary/10"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">-</Text>
                  </TouchableOpacity>
                  <Text className="font-bold text-2xl text-primary dark:text-white min-w-[32px] text-center">
                    {String(minutes).padStart(2, "0")}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setMinutes(Math.min(55, minutes + 5))}
                    className="w-9 h-9 border-2 border-primary dark:border-white items-center justify-center bg-transparent active:bg-primary/10"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Confirm Action Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSetTimer}
              className="bg-primary dark:bg-white border-2 border-primary dark:border-white py-3 px-4 items-center justify-center mt-2 active:opacity-90"
            >
              <Text numberOfLines={1} className="font-bold text-xs text-white dark:text-black uppercase tracking-widest">
                SET DAILY LOCK FOR {selectedApp.appName.toUpperCase()}
              </Text>
            </TouchableOpacity>
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
