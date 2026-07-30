import React from "react";
import { View } from "react-native";

interface ProgressBarProps {
  progressPercent: number; // 0 to 100
  isLocked?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progressPercent,
  isLocked = false,
}) => {
  const clamped = Math.min(100, Math.max(0, progressPercent));

  return (
    <View className="w-full h-2 bg-surface-container dark:bg-zinc-800 rounded-none overflow-hidden border border-primary dark:border-white">
      <View
        className={`h-full ${
          isLocked ? "bg-primary dark:bg-white" : "bg-secondary dark:bg-zinc-400"
        }`}
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
};
