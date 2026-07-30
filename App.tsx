import "./global.css";
import React from "react";
import { View, StatusBar } from "react-native";
import { AppProvider, useApp } from "./src/context/AppContext";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { PermissionsScreen } from "./src/screens/PermissionsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { AddAppScreen } from "./src/screens/AddAppScreen";
import { BlackoutScreen } from "./src/screens/BlackoutScreen";
import { StatsScreen } from "./src/screens/StatsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

const MainContent: React.FC = () => {
  const { currentScreen, effectiveTheme } = useApp();

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
      case "blackout":
        return <BlackoutScreen />;
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
    <View className={`flex-1 ${isDark ? "dark bg-black" : "bg-background"}`}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {renderScreen()}
    </View>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
