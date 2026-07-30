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
      <View className="flex-1 bg-black/80 justify-center items-center px-margin-page">
        <View className="w-full bg-white dark:bg-black border-2 border-primary dark:border-white p-6 rounded-lg flex-col gap-4">
          <View className="flex-row items-center gap-3">
            <AlertTriangle size={28} color="#000000" className="dark:text-white" />
            <Text className="font-bold text-xl uppercase tracking-tight text-primary dark:text-white flex-1">
              {title}
            </Text>
          </View>

          <Text className="text-base text-secondary dark:text-zinc-300 leading-relaxed">
            {description}
          </Text>

          <View className="bg-surface-container dark:bg-zinc-900 p-3 border border-primary dark:border-white">
            <Text className="text-xs font-bold uppercase text-primary dark:text-white text-center">
              ⚠️ This lock cannot be edited, paused, or undone today.
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
