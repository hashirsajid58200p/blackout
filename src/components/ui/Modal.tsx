import React from "react";
import { Modal as RNModal, View, Text } from "react-native";
import { Button } from "./Button";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react-native";
import { useApp } from "../../context/AppContext";

export type ModalVariant = "default" | "danger" | "warning" | "info" | "success";

export interface ModalProps {
  visible: boolean;
  title: string;
  description: string;
  variant?: ModalVariant;
  icon?: React.ReactNode;
  calloutText?: string;
  calloutVariant?: "danger" | "warning" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "danger";
  singleButton?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  title,
  description,
  variant = "default",
  icon,
  calloutText,
  calloutVariant = "danger",
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  confirmVariant,
  singleButton = false,
  onConfirm,
  onCancel,
}) => {
  const { effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";

  const renderIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "danger":
      case "warning":
        return <AlertTriangle size={22} color="#B23A2E" strokeWidth={1.5} />;
      case "success":
        return <CheckCircle2 size={22} color="#4F7566" strokeWidth={1.5} />;
      case "info":
      default:
        return <Info size={22} color={iconColor} strokeWidth={1.5} />;
    }
  };

  const resolvedConfirmVariant =
    confirmVariant || (variant === "danger" ? "danger" : "primary");

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/70 justify-center items-center px-margin-page">
        <View className="w-full max-w-[360px] bg-paper-surface dark:bg-espresso-surface border border-hairline dark:border-hairline-dark p-6 rounded flex-col gap-4 shadow-xl">
          <View className="flex-row items-center gap-3">
            {renderIcon()}
            <Text
              numberOfLines={2}
              className="font-display text-xl text-ink dark:text-bone tracking-tight flex-1"
            >
              {title}
            </Text>
          </View>

          <Text className="font-body text-sm text-ink-muted dark:text-bone-muted leading-relaxed">
            {description}
          </Text>

          {calloutText ? (
            <View
              className={`p-3 border rounded-sm ${
                calloutVariant === "info"
                  ? "bg-ink/5 dark:bg-bone/5 border-hairline dark:border-hairline-dark"
                  : "bg-stamp-red/10 border-stamp-red/30"
              }`}
            >
              <Text
                className={`text-xs font-mono-medium uppercase text-center tracking-wider ${
                  calloutVariant === "info"
                    ? "text-ink-muted dark:text-bone-muted"
                    : "text-stamp-red"
                }`}
              >
                {calloutText}
              </Text>
            </View>
          ) : null}

          <View className="flex-col gap-2.5 pt-2">
            {singleButton ? (
              <Button
                label={confirmLabel || "DISMISS"}
                onPress={onConfirm || onCancel}
                variant={resolvedConfirmVariant}
              />
            ) : (
              <>
                <Button
                  label={confirmLabel}
                  onPress={onConfirm || onCancel}
                  variant={resolvedConfirmVariant}
                />
                <Button
                  label={cancelLabel}
                  onPress={onCancel}
                  variant="secondary"
                />
              </>
            )}
          </View>
        </View>
      </View>
    </RNModal>
  );
};

