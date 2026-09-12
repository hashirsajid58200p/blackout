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
      <View className="bg-stamp-red/10 border border-stamp-red px-2 py-0.5 rounded-sm flex-row items-center justify-center gap-1 min-h-[22px]">
        <Lock size={11} color="#B23A2E" strokeWidth={1.25} />
        <Text className="text-stamp-red font-mono-bold text-[10px] uppercase tracking-wider leading-none">
          LOCKED
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-stamp-olive/10 border border-stamp-olive px-2 py-0.5 rounded-sm flex-row items-center justify-center gap-1 min-h-[22px]">
      <Check size={11} color="#4F7566" strokeWidth={1.25} />
      <Text className="text-stamp-olive font-mono-bold text-[10px] uppercase tracking-wider leading-none">
        ACTIVE
      </Text>
    </View>
  );
};
