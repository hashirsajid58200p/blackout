import React, { useState } from "react";
import { View, Text, TouchableOpacity, StatusBar, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { StorageService } from "../services/storage";
import { Button } from "../components/ui/Button";
import { Shield, Lock, Zap } from "lucide-react-native";

export const OnboardingScreen: React.FC = () => {
  const { setCurrentScreen, refreshPermissions, effectiveTheme } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === "dark";
  const iconColor = isDark ? "#E6E8EC" : "#1A2030";
  const [slideIndex, setSlideIndex] = useState(0);

  const topPadding =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight || 0) + 12
      : Math.max(insets.top, 16);

  const slides = [
    {
      icon: Shield,
      title: "Monolithic Focus",
      subtitle: "RECLAIM YOUR TIME",
      description:
        "Blackout is an analog-calm, strict digital wellbeing tool. Zero distractions, absolute focus control.",
    },
    {
      icon: Lock,
      title: "Immutable Limits",
      subtitle: "NO BYPASSES",
      description:
        "Once a daily limit is set, it cannot be edited, paused, or deleted until midnight. Discipline by design.",
    },
    {
      icon: Zap,
      title: "Instant Blocking",
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
    <View style={{ paddingTop: topPadding }} className="flex-1 bg-paper dark:bg-espresso justify-between p-margin-page">
      <View className="flex-row justify-between items-center pt-2">
        <Text className="font-display text-lg tracking-wider text-ink dark:text-bone uppercase">
          BLACKOUT
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={async () => {
            await StorageService.setOnboardingCompleted(true);
            setCurrentScreen("permissions");
          }}
        >
          <Text className="font-body-semibold text-xs text-ink-muted dark:text-bone-muted uppercase tracking-widest">
            SKIP
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-col gap-6 my-auto">
        <View className="w-14 h-14 bg-paper-surface dark:bg-espresso-surface justify-center items-center rounded-none border border-hairline dark:border-hairline-dark">
          <IconComponent size={24} color={iconColor} strokeWidth={1.25} />
        </View>

        <View className="flex-col gap-2">
          <Text className="text-[11px] font-body-bold text-ink-muted dark:text-bone-muted uppercase tracking-[0.12em]">
            {slides[slideIndex].subtitle}
          </Text>
          <Text className="text-3xl font-display text-ink dark:text-bone tracking-tight">
            {slides[slideIndex].title}
          </Text>
          <Text className="text-base font-body text-ink-muted dark:text-bone-muted leading-relaxed pt-1">
            {slides[slideIndex].description}
          </Text>
        </View>
      </View>

      <View className="flex-col gap-5 pb-4">
        {/* Step Indicator Rectilinear Tabs */}
        <View className="flex-row gap-2 justify-center items-center">
          {slides.map((_, idx) => (
            <View
              key={idx}
              className={`h-1 rounded-none ${
                idx === slideIndex
                  ? "w-8 bg-ink dark:bg-bone"
                  : "w-4 bg-hairline dark:bg-hairline-dark"
              }`}
            />
          ))}
        </View>

        <Button
          label={slideIndex === slides.length - 1 ? "GET STARTED" : "CONTINUE"}
          onPress={handleNext}
        />
      </View>
    </View>
  );
};
