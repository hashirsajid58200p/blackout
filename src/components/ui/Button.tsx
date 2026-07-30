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
  let containerStyles = "h-touch-target flex-row items-center justify-center px-6 rounded-none active:scale-95 transition-transform ";
  let textStyles = "font-bold text-base uppercase tracking-wider ";

  if (variant === "primary") {
    containerStyles += "bg-primary dark:bg-white text-white border-2 border-primary dark:border-white";
    textStyles += "text-white dark:text-black";
  } else if (variant === "secondary") {
    containerStyles += "bg-transparent text-primary dark:text-white border-2 border-primary dark:border-white";
    textStyles += "text-primary dark:text-white";
  } else if (variant === "danger") {
    containerStyles += "bg-error text-white border-2 border-error";
    textStyles += "text-white";
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
