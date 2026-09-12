import "./global.css";
import React, { useEffect } from "react";
import { View, StatusBar, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  LibreCaslonText_400Regular,
  LibreCaslonText_700Bold,
} from "@expo-google-fonts/libre-caslon-text";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from "@expo-google-fonts/public-sans";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from "@expo-google-fonts/ibm-plex-mono";
import { AppProvider, useApp } from "./src/context/AppContext";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { PermissionsScreen } from "./src/screens/PermissionsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { AddAppScreen } from "./src/screens/AddAppScreen";
import { StatsScreen } from "./src/screens/StatsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

const MainContent: React.FC = () => {
  const { currentScreen, setCurrentScreen, effectiveTheme } = useApp();

  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen !== "home" && currentScreen !== "onboarding") {
        setCurrentScreen("home");
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [currentScreen, setCurrentScreen]);

  const renderScreen = () => {
    switch (currentScreen) {
      case "onboarding":
        return <OnboardingScreen />;
      case "permissions":
        return <PermissionsScreen />;
      case "home":
        return <HomeScreen />;
      case "add_app":
        return <AddAppScreen />;
      case "stats":
        return <StatsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const isDark = effectiveTheme === "dark";

  return (
    <View className="flex-1 bg-paper dark:bg-espresso">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      {renderScreen()}
    </View>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    LibreCaslonText_400Regular,
    LibreCaslonText_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}
