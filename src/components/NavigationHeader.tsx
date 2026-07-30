import React from "react";
import { View, Text, TouchableOpacity, StatusBar, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { Calendar, Settings as SettingsIcon, ChevronLeft } from "lucide-react-native";

interface NavigationHeaderProps {
  title?: string;
  showBack?: boolean;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  title = "TODAY",
  showBack = false,
}) => {
  const { currentScreen, setCurrentScreen, effectiveTheme } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";

  const topPadding = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0
  );

  return (
    <View
      style={{ paddingTop: topPadding }}
      className="bg-background dark:bg-black border-b-2 border-primary dark:border-white z-40"
    >
      <View className="py-2.5 flex-row justify-between items-center px-margin-page min-h-[52px]">
        {showBack ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCurrentScreen("home")}
            className="w-8 h-8 items-center justify-center border border-primary dark:border-white active:bg-primary/10"
          >
            <ChevronLeft size={18} color={iconColor} />
          </TouchableOpacity>
        ) : (
          <View className="w-8 h-8" />
        )}

        <Text className="font-bold text-xl uppercase tracking-tighter text-primary dark:text-white">
          {title}
        </Text>

        <View className="w-8 h-8" />
      </View>
    </View>
  );
};
