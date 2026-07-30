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
  const fillOpacity = Math.max(0.35, clamped / 100);

  return (
    <View className="w-full h-2.5 bg-surface-container dark:bg-zinc-900 rounded-none overflow-hidden border border-primary dark:border-white">
      <View
        className="h-full bg-primary dark:bg-white"
        style={{ width: `${clamped}%`, opacity: isLocked ? 1 : fillOpacity }}
      />
    </View>
  );
};
