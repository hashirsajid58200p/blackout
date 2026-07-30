import React from "react";
import { View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "locked";
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  className = "",
  ...props
}) => {
  const baseStyle =
    "border-2 border-primary dark:border-white p-4 rounded-none bg-surface-container-lowest dark:bg-black ";
  const lockedStyle = variant === "locked" ? "bg-surface-container-low dark:bg-zinc-950 " : "";

  return (
    <View className={`${baseStyle}${lockedStyle}${className}`} {...props}>
      {children}
    </View>
  );
};
