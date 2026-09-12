import React from "react";
import { View, Text, TouchableOpacity, StatusBar, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { ChevronLeft } from "lucide-react-native";

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
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";

  // Calculate safe top padding for all Android notches/camera punch-holes and iOS status bars
  const topPadding =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight || 0) + 12
      : Math.max(insets.top, 16);

  return (
    <View
      style={{ paddingTop: topPadding }}
      className="bg-paper dark:bg-espresso border-b border-hairline dark:border-hairline-dark z-40"
    >
      <View className="py-2.5 flex-row justify-between items-center px-margin-page min-h-[52px]">
        {showBack ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentScreen("home")}
            className="w-8 h-8 items-center justify-center border border-hairline dark:border-hairline-dark rounded-none active:bg-ink/5 dark:active:bg-bone/5"
          >
            <ChevronLeft size={18} color={iconColor} strokeWidth={1.25} />
          </TouchableOpacity>
        ) : (
          <View className="w-8 h-8" />
        )}

        <Text className="font-display text-lg text-ink dark:text-bone tracking-[0.06em] uppercase">
          {title}
        </Text>

        <View className="w-8 h-8" />
      </View>
    </View>
  );
};
