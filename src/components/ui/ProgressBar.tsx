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
    <View className="w-full h-1.5 bg-paper dark:bg-espresso rounded-none overflow-hidden border border-hairline dark:border-hairline-dark">
      <View
        className={`h-full ${isLocked ? "bg-stamp-red" : "bg-brass dark:bg-brass"}`}
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
};
