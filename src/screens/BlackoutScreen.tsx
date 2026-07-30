import React from "react";
import { View, Text, SafeAreaView } from "react-native";
import { useApp } from "../context/AppContext";
import { Button } from "../components/ui/Button";

export const BlackoutScreen: React.FC = () => {
  const { activeBlockApp, setCurrentScreen, setActiveBlockApp } = useApp();

  const appName = activeBlockApp?.appName || "Application";

  const handleClose = () => {
    setActiveBlockApp(null);
    setCurrentScreen("home");
  };

  return (
    <SafeAreaView className="flex-1 bg-black p-margin-page justify-between">
      <View className="flex-1 items-center justify-center text-center my-auto">
        {/* Minimalist Eclipse / Monolith circle icon */}
        <View className="w-28 h-28 rounded-full border-2 border-white bg-black mb-8 items-center justify-center">
          <View className="w-20 h-20 rounded-full border-r-2 border-zinc-500 bg-black" />
        </View>

        <Text className="font-bold text-3xl text-white uppercase tracking-tight text-center mb-3">
          {appName} IS DARK.
        </Text>

        <Text className="text-lg text-zinc-400 text-center max-w-[280px]">
          Time's up for today. It unlocks at midnight.
        </Text>
      </View>

      <View className="flex-col items-center gap-6 pb-8">
        <Text className="text-sm text-zinc-400 text-center max-w-[280px] leading-relaxed">
          The only way around this is deleting the app. That's the point.
        </Text>

        <Button label="CLOSE" onPress={handleClose} variant="primary" />
      </View>
    </SafeAreaView>
  );
};
