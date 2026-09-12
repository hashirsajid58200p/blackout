import React from "react";
import { TouchableOpacity, Text, View } from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
  fullWidth = true,
}) => {
  let containerStyles = "h-touch-target flex-row items-center justify-center px-6 rounded-none border ";
  let textStyles = "font-body-bold text-xs uppercase tracking-[0.1em] ";

  if (variant === "primary") {
    containerStyles += "bg-ink dark:bg-bone border-ink dark:border-bone";
    textStyles += "text-paper dark:text-espresso";
  } else if (variant === "secondary") {
    containerStyles += "bg-transparent border-hairline dark:border-hairline-dark";
    textStyles += "text-ink dark:text-bone font-body-semibold";
  } else if (variant === "danger") {
    containerStyles += "bg-transparent dark:bg-espresso-surface border-stamp-red";
    textStyles += "text-stamp-red";
  }

  if (disabled) {
    containerStyles += " opacity-40";
  }

  if (fullWidth) {
    containerStyles += " w-full";
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      className={containerStyles}
    >
      {icon && <View className="mr-2">{icon}</View>}
      <Text className={textStyles}>{label}</Text>
    </TouchableOpacity>
  );
};
