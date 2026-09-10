# Project Brief: Blackout

## Overview
**Blackout** is an offline, zero-telemetry, strict achromatic digital wellbeing application built with **React Native (Expo SDK 54 / bare workflow)** and custom **Android Native Modules (Kotlin)**. It enforces immutable daily screen-time allowances on chosen applications. Once an app reaches its set limit, it is instantly blocked for the rest of the day until midnight.

## Core Philosophy & Design Language
- **Design Aesthetic**: "Monolith Minimalist" — uncompromising high-contrast monochrome design.
- **Palette**: Pure blacks (`#000000`), stark whites (`#ffffff`), and calibrated neutral grays (`#5e5e5e`, `#7e7576`, `#f9f9f9`, `#27272a`).
- **Typography & Structure**: Bold uppercase tracking, sharp geometric cards, 2px borders, zero soft pill rounding (except small indicators).
- **Discipline by Design**: No bypasses, no pause timers, no midday editing. Limits reset automatically at midnight.

## Tech Stack
- **Framework**: React Native `0.81.5`, React `19.1.0`, Expo `~54.0.36` (prebuild workflow).
- **Language**: TypeScript `^5.3.3`.
- **Styling**: NativeWind `^4.0.1` / Tailwind CSS `^3.4.17` with custom color tokens and dark mode support.
- **Icons**: `lucide-react-native`.
- **Storage**: `@react-native-async-storage/async-storage` (`v2.2.0`).
- **Native Android Components**:
  - `BlackoutAccessibilityService.kt`: Real-time foreground app detection (`TYPE_WINDOW_STATE_CHANGED`), redirecting blocked packages to `GLOBAL_ACTION_HOME` and displaying an overlay.
  - `BlackoutModule.kt`: React Native bridge module querying `UsageEvents` / `UsageStatsManager`, listing installed apps with Base64 icons, querying/launching permissions (Usage Stats, Draw Over Apps, Accessibility, Device Admin).
  - `BlackoutDeviceAdminReceiver.kt`: Device administrator receiver to prevent uninstalling Blackout to bypass limits.
  - `plugins/withBlackoutNativeModule.js`: Expo config plugin injecting permissions, manifest declarations, and native Kotlin source files.

## Architecture & Data Flow
1. **Frontend State & Navigation**:
   - `src/context/AppContext.tsx`: Central state management. Tracks `currentScreen`, `trackedApps`, `settings`, and native `permissions`.
   - Single-page view router in `App.tsx` switching between: `onboarding`, `permissions`, `home`, `add_app`, `blackout`, `stats`, and `settings`.
2. **Persistence**:
   - `src/services/storage.ts`: Handles `AsyncStorage` operations for `tracked_apps`, `settings`, and `onboarding_completed`.
   - Automated midnight reset logic: resets `usedTodayMs = 0` and `isLocked = false` when date differs from `lockDate`.
3. **Multi-System Data Sync**:
   - Entity: `TrackedApp` / `LockedApp`.
   - System 1 (Primary App Storage): `AsyncStorage` key `tracked_apps`.
   - System 2 (Native Android Storage): Android `SharedPreferences` (`BlackoutPrefs` -> `locked_apps_json`).
   - System 3 (Native Runtime Memory): `BlackoutAccessibilityService.lockedPackages` in-memory companion set.

## Breakpoint & Layout Standards
- **Target OS**: Android (API 26-35) with iOS compatibility scaffolding.
- **Safe Area Insets**: Dynamic calculation using `useSafeAreaInsets` + `StatusBar.currentHeight` ensuring notch and camera punch-hole clearance.
- **Horizontal Margins**: 24px (`px-margin-page`).
- **Buttons / Touch Targets**: Minimum 44-48px height with uppercase tracking.
