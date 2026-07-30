/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        "on-primary": "#ffffff",
        secondary: "#5e5e5e",
        "on-secondary": "#ffffff",
        tertiary: "#000000",
        surface: "#f9f9f9",
        "surface-container": "#eeeeee",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f4",
        "surface-container-high": "#e8e8e8",
        "surface-bright": "#f9f9f9",
        background: "#f9f9f9",
        "on-background": "#1a1c1c",
        outline: "#7e7576",
        "outline-variant": "#cfc4c5",
        error: "#ba1a1a",
        "on-error": "#ffffff",
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        full: "9999px",
      },
      spacing: {
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
        "margin-page": "24px",
        "gutter-grid": "16px",
        "touch-target": "48px",
      },
    },
  },
  plugins: [],
};
