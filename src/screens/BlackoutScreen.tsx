import React from "react";
import { View, Text, SafeAreaView, TouchableOpacity } from "react-native";
import { useApp } from "../context/AppContext";

export const BlackoutScreen: React.FC = () => {
  const { activeBlockApp, setCurrentScreen, setActiveBlockApp } = useApp();

  const appName = activeBlockApp?.appName || "Application";

  const handleClose = () => {
    setActiveBlockApp(null);
    setCurrentScreen("home");
  };

  return (
    <SafeAreaView className="flex-1 bg-espresso p-margin-page justify-between">
      <View className="flex-1 items-center justify-center text-center my-auto px-4">
        {/* Stamped Rubber-badge / Eclipse icon */}
        <View className="w-24 h-24 rounded-full border border-stamp-red/80 bg-espresso-surface mb-8 items-center justify-center -rotate-3">
          <View className="w-16 h-16 rounded-full border border-hairline-dark items-center justify-center">
            <Text className="font-mono-bold text-[11px] text-stamp-red uppercase tracking-widest">
              LOCKED
            </Text>
          </View>
        </View>

        <Text className="font-display font-semibold text-3xl text-bone tracking-tight text-center mb-3">
          {appName} is dark.
        </Text>

        <Text className="font-body text-base text-bone-muted text-center max-w-[280px] leading-relaxed">
          Time's up for today. It unlocks at midnight.
        </Text>
      </View>

      <View className="flex-col items-center gap-6 pb-8 px-4">
        <Text className="font-body text-xs text-bone-muted text-center max-w-[280px] leading-relaxed">
          The only way around this is deleting the app. That's the point.
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleClose}
          className="w-full py-3.5 bg-bone border border-bone rounded items-center justify-center active:opacity-90"
        >
          <Text className="font-body-semibold text-xs text-espresso uppercase tracking-widest">
            RETURN TO HOME
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
