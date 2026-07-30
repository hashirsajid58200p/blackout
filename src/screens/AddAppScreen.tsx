import React, { useState } from "react";
import { View, Text, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { NavigationHeader } from "../components/NavigationHeader";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Search, Camera, Video, MessageSquare, Globe, Clock, Check } from "lucide-react-native";
import { InstalledAppInfo } from "../types";

const POPULAR_APPS: InstalledAppInfo[] = [
  { packageName: "com.instagram.android", appName: "Instagram", category: "Social" },
  { packageName: "com.google.android.youtube", appName: "YouTube", category: "Media" },
  { packageName: "com.zhiliaoapp.musically", appName: "TikTok", category: "Social" },
  { packageName: "com.reddit.frontpage", appName: "Reddit", category: "News & Social" },
  { packageName: "com.twitter.android", appName: "X / Twitter", category: "Social" },
  { packageName: "com.android.chrome", appName: "Google Chrome", category: "Browser" },
  { packageName: "com.netflix.mediaclient", appName: "Netflix", category: "Entertainment" },
  { packageName: "com.snapchat.android", appName: "Snapchat", category: "Social" },
];

export const AddAppScreen: React.FC = () => {
  const { trackedApps, addTrackedApp, setCurrentScreen } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<InstalledAppInfo | null>(null);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const filteredApps = POPULAR_APPS.filter((app) =>
    app.appName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIcon = (appName: string) => {
    const lower = appName.toLowerCase();
    if (lower.includes("insta") || lower.includes("camera")) return Camera;
    if (lower.includes("you") || lower.includes("video") || lower.includes("netf"))
      return Video;
    if (lower.includes("chat") || lower.includes("snap")) return MessageSquare;
    return Globe;
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
      selectedApp.category
    );

    setShowConfirmModal(false);
    if (res.success) {
      setCurrentScreen("home");
    } else {
      Alert.alert("Lock Failed", res.error || "Could not set lock.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-black">
      <NavigationHeader title="SET TIMER" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="px-margin-page pt-4 flex-1">
        {/* Step 1: Search & Pick App */}
        <View className="flex-col gap-2 mb-4">
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            STEP 1 — SELECT TARGET APPLICATION
          </Text>
          <View className="flex-row items-center border-2 border-primary dark:border-white bg-surface-container-lowest dark:bg-zinc-900 px-3 h-12">
            <Search size={20} color="#000000" className="dark:text-white" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="SEARCH INSTALLED APPS..."
              placeholderTextColor="#7e7576"
              className="flex-1 ml-3 font-bold text-sm text-primary dark:text-white uppercase"
            />
          </View>
        </View>

        {/* App Selection Grid / List */}
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
                className={`p-4 border-2 flex-row justify-between items-center ${
                  isAlreadyTracked
                    ? "border-outline opacity-40 bg-surface-container dark:bg-zinc-900"
                    : isSelected
                    ? "border-primary bg-primary dark:bg-white text-white"
                    : "border-primary dark:border-white bg-surface-container-lowest dark:bg-black"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <IconComp
                    size={20}
                    color={isSelected ? "#ffffff" : "#000000"}
                    className={isSelected ? "dark:text-black" : "dark:text-white"}
                  />
                  <View className="flex-col">
                    <Text
                      className={`font-bold text-base ${
                        isSelected
                          ? "text-white dark:text-black"
                          : "text-primary dark:text-white"
                      }`}
                    >
                      {app.appName}
                    </Text>
                    <Text
                      className={`text-xs ${
                        isSelected
                          ? "text-zinc-300 dark:text-zinc-700"
                          : "text-secondary dark:text-zinc-400"
                      }`}
                    >
                      {app.category}
                    </Text>
                  </View>
                </View>

                {isAlreadyTracked ? (
                  <Text className="text-xs font-bold uppercase text-secondary">
                    LOCKED TODAY
                  </Text>
                ) : isSelected ? (
                  <View className="w-6 h-6 rounded-full bg-white dark:bg-black items-center justify-center">
                    <Check size={14} color="#000000" className="dark:text-white" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Step 2: Time Selector */}
        {selectedApp && (
          <View className="flex-col gap-4 mb-8 border-2 border-primary dark:border-white p-4 bg-surface-container-lowest dark:bg-zinc-900">
            <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
              STEP 2 — SET DAILY ALLOWANCE
            </Text>

            <View className="flex-row justify-around items-center py-4">
              {/* Hours Picker */}
              <View className="flex-col items-center">
                <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase mb-2">
                  HOURS
                </Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setHours(Math.max(0, hours - 1))}
                    className="w-10 h-10 border border-primary dark:border-white items-center justify-center"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">-</Text>
                  </TouchableOpacity>
                  <Text className="font-bold text-3xl text-primary dark:text-white w-12 text-center">
                    {hours}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setHours(Math.min(12, hours + 1))}
                    className="w-10 h-10 border border-primary dark:border-white items-center justify-center"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text className="font-bold text-2xl text-primary dark:text-white">:</Text>

              {/* Minutes Picker */}
              <View className="flex-col items-center">
                <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase mb-2">
                  MINUTES
                </Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setMinutes(Math.max(0, minutes - 5))}
                    className="w-10 h-10 border border-primary dark:border-white items-center justify-center"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">-</Text>
                  </TouchableOpacity>
                  <Text className="font-bold text-3xl text-primary dark:text-white w-12 text-center">
                    {String(minutes).padStart(2, "0")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setMinutes(Math.min(55, minutes + 5))}
                    className="w-10 h-10 border border-primary dark:border-white items-center justify-center"
                  >
                    <Text className="font-bold text-lg text-primary dark:text-white">+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Button
              label={`SET LOCK FOR ${selectedApp.appName}`}
              onPress={handleSetTimer}
            />
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
    </SafeAreaView>
  );
};
