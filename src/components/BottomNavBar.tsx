import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { LayoutGrid, BarChart2, ShieldAlert, Settings as SettingsIcon } from "lucide-react-native";

export const BottomNavBar: React.FC = () => {
  const { currentScreen, setCurrentScreen, effectiveTheme } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === "dark";

  const navItems = [
    { id: "home", icon: LayoutGrid, label: "Home" },
    { id: "stats", icon: BarChart2, label: "Stats" },
    { id: "permissions", icon: ShieldAlert, label: "Permissions" },
    { id: "settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="absolute bottom-0 left-0 right-0 bg-background dark:bg-black border-t-2 border-primary dark:border-white flex-row justify-around items-center pt-2 z-50"
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = currentScreen === item.id;
        const iconColor = isActive
          ? isDark
            ? "#000000"
            : "#ffffff"
          : isDark
          ? "#a3a3a3"
          : "#737373";

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => setCurrentScreen(item.id as any)}
            className={`w-12 h-12 justify-center items-center rounded-none border ${
              isActive
                ? "bg-primary dark:bg-white border-primary dark:border-white"
                : "bg-transparent border-transparent"
            }`}
          >
            <IconComponent size={22} color={iconColor} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
