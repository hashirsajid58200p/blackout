import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { LayoutGrid, BarChart2, Settings as SettingsIcon } from "lucide-react-native";

export const BottomNavBar: React.FC = () => {
  const { currentScreen, setCurrentScreen, effectiveTheme } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === "dark";

  const navItems = [
    { id: "home", icon: LayoutGrid, label: "Home" },
    { id: "stats", icon: BarChart2, label: "Stats" },
    { id: "settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      className="absolute bottom-0 left-0 right-0 bg-paper dark:bg-espresso border-t border-hairline dark:border-hairline-dark flex-row justify-around items-center pt-2 z-50"
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = currentScreen === item.id;
        const iconColor = isActive
          ? isDark
            ? "#E6E8EC"
            : "#1A2030"
          : isDark
          ? "#8C93A6"
          : "#5C6478";

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPress={() => setCurrentScreen(item.id as any)}
            className="flex-1 items-center justify-center py-1"
          >
            <IconComponent size={20} color={iconColor} strokeWidth={isActive ? 1.75 : 1.25} />
            <View className="mt-1">
              <Text
                className={`text-[10px] uppercase tracking-widest ${
                  isActive
                    ? "font-body-semibold text-ink dark:text-bone"
                    : "font-body text-ink-muted dark:text-bone-muted"
                }`}
              >
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
