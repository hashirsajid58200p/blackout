/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Google Stitch Ledger Instrument Design System Tokens
        // Light Ledger Paper Mode
        paper: "#E6E8EC",
        "paper-surface": "#EFF1F4",
        ink: "#1A2030",
        "ink-muted": "#5C6478",
        hairline: "#C9CDD6",

        // Dark Archival Obsidian Mode (from DESIGN.md)
        espresso: "#0F131C",
        "espresso-surface": "#181C25",
        "espresso-card": "#1C2029",
        "espresso-high": "#262A34",
        "espresso-highest": "#31353F",
        bone: "#DFE2EF",
        "bone-muted": "#909097",
        "bone-variant": "#C6C6CD",
        "hairline-dark": "#45464C",

        // Functional Ledger Stamps & Accents
        "stamp-red": "#B23A2E",
        "stamp-red-light": "#FFB4AB",
        brass: "#F0BE78",
        "brass-muted": "#DDAD69",
        "brass-deep": "#A67C3D",
        "brass-container": "#614003",
        "stamp-brass": "#F0BE78",
        "stamp-olive": "#4F7566",

        // Semantic Tokens (Default Light, paired with dark: classes)
        background: "#E6E8EC",
        surface: "#EFF1F4",
        "surface-container": "#E6E8EC",
        "surface-container-low": "#ECEEF2",
        "surface-container-high": "#E0E3E8",
        "surface-container-lowest": "#EFF1F4",
        primary: "#1A2030",
        "on-primary": "#E6E8EC",
        secondary: "#5C6478",
        "on-secondary": "#EFF1F4",
        border: "#C9CDD6",
        outline: "#5C6478",
        "outline-variant": "#C9CDD6",
        error: "#B23A2E",
        "on-error": "#FFFFFF",
      },
      fontFamily: {
        // In React Native Android, fontFamily cannot have comma-separated fallbacks
        display: ["LibreCaslonText_700Bold"],
        "display-bold": ["LibreCaslonText_700Bold"],
        "display-regular": ["LibreCaslonText_400Regular"],
        "display-medium": ["LibreCaslonText_700Bold"],
        body: ["PublicSans_400Regular"],
        "body-regular": ["PublicSans_400Regular"],
        "body-medium": ["PublicSans_500Medium"],
        "body-semibold": ["PublicSans_600SemiBold"],
        "body-bold": ["PublicSans_700Bold"],
        mono: ["IBMPlexMono_400Regular"],
        "mono-regular": ["IBMPlexMono_400Regular"],
        "mono-medium": ["IBMPlexMono_500Medium"],
        "mono-semibold": ["IBMPlexMono_600SemiBold"],
        "mono-bold": ["IBMPlexMono_700Bold"],
      },
      borderWidth: {
        DEFAULT: "1px",
        hairline: "1px",
        0: "0px",
        1: "1px",
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        full: "2px",
      },
      boxShadow: {
        none: "none",
        sm: "none",
        DEFAULT: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
      },
      spacing: {
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
        "margin-page": "16px",
        "gutter-grid": "12px",
        "touch-target": "48px",
      },
    },
  },
  plugins: [],
};
