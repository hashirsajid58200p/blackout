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
    "border border-hairline dark:border-hairline-dark p-4 rounded bg-paper-surface dark:bg-espresso-surface ";
  const lockedStyle =
    variant === "locked"
      ? "border-stamp-red/40 dark:border-stamp-red/40 "
      : "";

  return (
    <View className={`${baseStyle}${lockedStyle}${className}`} {...props}>
      {children}
    </View>
  );
};
