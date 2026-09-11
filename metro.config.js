const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "react-native-reanimated": path.resolve(__dirname, "src/services/reanimated-mock.js"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
