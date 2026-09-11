import React from "react";
import { Modal as RNModal, View, Text, TouchableOpacity } from "react-native";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react-native";

interface ModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  title,
  description,
  confirmLabel = "Confirm Lock",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-margin-page">
        <View className="w-full bg-paper-surface dark:bg-espresso-surface border border-hairline dark:border-hairline-dark p-6 rounded flex-col gap-4">
          <View className="flex-row items-center gap-3">
            <AlertTriangle size={24} color="#B23A2E" strokeWidth={1.25} />
            <Text className="font-display text-xl text-ink dark:text-bone tracking-tight flex-1">
              {title}
            </Text>
          </View>

          <Text className="font-body text-sm text-ink-muted dark:text-bone-muted leading-relaxed">
            {description}
          </Text>

          <View className="bg-stamp-red/10 p-3 border border-stamp-red/30 rounded-sm">
            <Text className="text-xs font-mono-medium uppercase text-stamp-red text-center tracking-wider">
              This lock cannot be edited, paused, or undone today.
            </Text>
          </View>

          <View className="flex-col gap-3 pt-2">
            <Button label={confirmLabel} onPress={onConfirm} variant="primary" />
            <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
          </View>
        </View>
      </View>
    </RNModal>
  );
};
