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
    <View className="w-full h-2 bg-paper-surface dark:bg-espresso-surface rounded-sm overflow-hidden border border-hairline dark:border-hairline-dark">
      <View
        className={`h-full ${isLocked ? "bg-stamp-red" : "bg-ink dark:bg-bone"}`}
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
};
