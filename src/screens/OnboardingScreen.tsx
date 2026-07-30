import React, { useState } from "react";
import { View, Text, SafeAreaView, TouchableOpacity } from "react-native";
import { useApp } from "../context/AppContext";
import { StorageService } from "../services/storage";
import { Button } from "../components/ui/Button";
import { Shield, Lock, Zap } from "lucide-react-native";

export const OnboardingScreen: React.FC = () => {
  const { setCurrentScreen, refreshPermissions, effectiveTheme } = useApp();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#000000" : "#ffffff";
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = [
    {
      icon: Shield,
      title: "MONOLITHIC FOCUS",
      subtitle: "RECLAIM YOUR TIME",
      description:
        "Blackout is a strict, achromatic digital wellbeing tool. Zero shadows, zero distractions, absolute focus control.",
    },
    {
      icon: Lock,
      title: "IMMUTABLE LIMITS",
      subtitle: "NO BYPASSES",
      description:
        "Once a daily limit is set, it cannot be edited, paused, or deleted until midnight. Discipline by design.",
    },
    {
      icon: Zap,
      title: "INSTANT BLOCKING",
      subtitle: "REAL-TIME OVERLAY",
      description:
        "Powered by Android Accessibility Service to instantly block locked apps the moment they hit the foreground.",
    },
  ];

  const handleNext = async () => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      await StorageService.setOnboardingCompleted(true);
      const allPerms = await refreshPermissions();
      if (!allPerms) {
        setCurrentScreen("permissions");
      } else {
        setCurrentScreen("home");
      }
    }
  };

  const IconComponent = slides[slideIndex].icon;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-black justify-between p-margin-page">
      <View className="flex-row justify-between items-center pt-4">
        <Text className="font-bold text-sm tracking-widest text-primary dark:text-white uppercase">
          BLACKOUT
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await StorageService.setOnboardingCompleted(true);
            setCurrentScreen("permissions");
          }}
        >
          <Text className="font-bold text-xs text-secondary dark:text-zinc-400 uppercase tracking-widest">
            SKIP
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-col gap-6 my-auto">
        <View className="w-16 h-16 bg-primary dark:bg-white justify-center items-center rounded-none border-2 border-primary dark:border-white">
          <IconComponent size={32} color={iconColor} />
        </View>

        <View className="flex-col gap-2">
          <Text className="text-xs font-bold text-secondary dark:text-zinc-400 uppercase tracking-widest">
            {slides[slideIndex].subtitle}
          </Text>
          <Text className="text-3xl font-bold uppercase tracking-tight text-primary dark:text-white">
            {slides[slideIndex].title}
          </Text>
          <Text className="text-base text-secondary dark:text-zinc-300 leading-relaxed pt-2">
            {slides[slideIndex].description}
          </Text>
        </View>
      </View>

      <View className="flex-col gap-6 pb-4">
        {/* Step Indicator */}
        <View className="flex-row gap-2">
          {slides.map((_, idx) => (
            <View
              key={idx}
              className={`h-1 flex-1 ${
                idx === slideIndex ? "bg-primary dark:bg-white" : "bg-surface-container dark:bg-zinc-800"
              }`}
            />
          ))}
        </View>

        <Button
          label={slideIndex === slides.length - 1 ? "GET STARTED" : "CONTINUE"}
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
};
