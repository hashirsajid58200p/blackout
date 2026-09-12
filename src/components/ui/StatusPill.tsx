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
    return (
      <View className="bg-stamp-red/10 border border-stamp-red px-2 py-0.5 rounded-none flex-row items-center justify-center gap-1 min-h-[22px]">
        <Lock size={11} color="#B23A2E" strokeWidth={1.25} />
        <Text className="text-stamp-red font-mono-bold text-[10px] uppercase tracking-[0.1em] leading-none">
          LOCKED
        </Text>
      </View>
    );
  }

  const brassColor = isDark ? "#A67C3D" : "#8A642B";

  return (
    <View className="bg-brass/10 border border-brass/50 dark:border-brass/50 px-2 py-0.5 rounded-none flex-row items-center justify-center gap-1 min-h-[22px]">
      <Check size={11} color={brassColor} strokeWidth={1.25} />
      <Text className="text-brass dark:text-brass font-mono-bold text-[10px] uppercase tracking-[0.1em] leading-none">
        ACTIVE
      </Text>
    </View>
  );
};
