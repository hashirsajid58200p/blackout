import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
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
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#ffffff" : "#000000";

  return (
    <View className="h-touch-target bg-background dark:bg-black border-b-2 border-primary dark:border-white flex-row justify-between items-center px-margin-page z-40">
      {showBack ? (
        <TouchableOpacity
          onPress={() => setCurrentScreen("home")}
          className="w-10 h-10 items-center justify-center border border-primary dark:border-white"
        >
          <ChevronLeft size={20} color={iconColor} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => setCurrentScreen("stats")}
          className="w-10 h-10 items-center justify-center border border-primary dark:border-white"
        >
          <Calendar size={20} color={iconColor} />
        </TouchableOpacity>
      )}

      <Text className="font-bold text-xl uppercase tracking-tighter text-primary dark:text-white">
        {title}
      </Text>

      <TouchableOpacity
        onPress={() => setCurrentScreen("settings")}
        className="w-10 h-10 items-center justify-center border border-primary dark:border-white"
      >
        <SettingsIcon size={20} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
};
