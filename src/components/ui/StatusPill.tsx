import React from "react";
import { View, Text } from "react-native";
import { Lock, Check } from "lucide-react-native";

interface StatusPillProps {
  isLocked: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({ isLocked }) => {
  if (isLocked) {
    return (
      <View className="bg-primary dark:bg-white px-3 py-1 rounded-none flex-row items-center gap-1 border border-primary dark:border-white">
        <Lock size={12} color="#ffffff" className="dark:text-black" />
        <Text className="text-white dark:text-black font-bold text-xs uppercase">
          Locked
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface-container dark:bg-zinc-800 px-3 py-1 rounded-none flex-row items-center gap-1 border border-outline-variant dark:border-zinc-700">
      <Check size={12} color="#5e5e5e" />
      <Text className="text-secondary dark:text-zinc-300 font-bold text-xs uppercase">
        Active
      </Text>
    </View>
  );
};
