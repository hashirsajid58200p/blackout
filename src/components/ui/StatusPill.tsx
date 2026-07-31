import React from "react";
import { View, Text } from "react-native";
import { Lock, Check } from "lucide-react-native";
import { useApp } from "../../context/AppContext";

interface StatusPillProps {
  isLocked: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({ isLocked }) => {
  const { effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";

  if (isLocked) {
    const iconColor = isDark ? "#000000" : "#ffffff";

    return (
      <View className="bg-primary dark:bg-white px-2.5 py-1 flex-row items-center justify-center gap-1.5 border border-primary dark:border-white min-h-[26px]">
        <Lock size={13} color={iconColor} />
        <Text className="text-white dark:text-black font-bold text-xs uppercase leading-none">
          LOCKED
        </Text>
      </View>
    );
  }

  const iconColor = isDark ? "#a1a1aa" : "#5e5e5e";

  return (
    <View className="bg-surface-container dark:bg-zinc-900 px-2.5 py-1 flex-row items-center justify-center gap-1.5 border border-outline-variant dark:border-zinc-700 min-h-[26px]">
      <Check size={13} color={iconColor} />
      <Text className="text-secondary dark:text-zinc-300 font-bold text-xs uppercase leading-none">
        ACTIVE
      </Text>
    </View>
  );
};
