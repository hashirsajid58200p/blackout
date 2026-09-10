# Progress Tracker

## Completed Features
- [x] **Project Scaffolding**: Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind v4 with Tailwind CSS.
- [x] **Monolith Design System**: High-contrast monochrome palette, sharp geometry, custom typography tokens, full dark/light mode support.
- [x] **Onboarding & Permission Flows**:
  - 3-step informative onboarding carousel with persistent completion state.
  - Granular permission management for Android Usage Access, System Alert Window (Overlay), Accessibility Service, and Device Administrator.
- [x] **Home Dashboard**:
  - Multi-segment SVG circular usage chart displaying proportionate app screen time.
  - Interactive segment highlighting with individual app usage breakdowns.
  - Locked applications list with progress bars and status badges.
- [x] **App Limiting / Lock Mechanism**:
  - App picker scanning installed Android packages with app icons.
  - Custom app identifier addition.
  - Immutable daily limit configuration (locked until midnight).
  - Storage midnight reset logic.
- [x] **Stats & Screen Time History**:
  - 7-day usage statistics bar chart.
  - Day offset navigation carousel (-6 days through today).
  - Individual app usage breakdown per selected day.
- [x] **Settings & Protection**:
  - System, Light, and Dark theme toggles.
  - Android Device Administrator activation to protect against bypass via uninstallation.
  - Locked apps read-only view.
- [x] **Android Native Module & Accessibility Service Architectural Fixes**:
  - Real-time `TYPE_WINDOW_STATE_CHANGED` delta accumulation in `BlackoutUsagePrefs`.
  - Precise usage tracking combining Accessibility real-time metrics with `UsageStatsManager` daily baseline.
  - Installed apps system filter excluding Calculator, Settings, and other system packages.
  - Complete elimination of mock/fake fallback app arrays.
  - Real-time system theme change propagation via `MainActivity.onConfigurationChanged` and `NativeEventEmitter`.
  - NativeWind v4 dynamic theme management without manual dark class injection.
  - Enterprise anti-uninstall protection intercepting `com.android.settings` and `packageinstaller` with `GLOBAL_ACTION_BACK` and overlay.
  - Daily 12:00 AM midnight reset using `AlarmManager` and `MidnightResetReceiver`.

- [x] **Critical Bug Fixes (Overlay Glitch, Real-time Tracking, Icon URI & Screen Time)**:
  - [x] **Bug 1 & 3: Apps Closing Instantly & Lock Screen Glitching**:
    - Removed `performGlobalAction(GLOBAL_ACTION_HOME)` from all blocking code. When an app is locked, it remains open covered by an untouchable full-screen overlay.
    - Added check in `showBlockingOverlay` to ignore duplicate events if the overlay is already showing for the package.
    - Ensured overlay consumes all touch events with `setOnTouchListener { _, _ -> true }` so user cannot tap the app underneath.
    - Added clean `removeBlockingOverlay` removing views safely and resetting state.
    - Fixed Settings / PackageInstaller anti-uninstall protection to display the full blocking overlay without calling `GLOBAL_ACTION_BACK`.
  - [x] **Bug 2a: Real App Icons with Cached File URIs**:
    - Replaced Base64 strings across the React Native bridge with local file caching in `cacheDir` (`icon_${pkg}.png`), eliminating the 1MB Android IPC Binder buffer limit.
    - Updated `InstalledAppInfo`, `TrackedApp`, and `DayAppUsage` to include `iconUri`.
    - Rendered `<Image source={{ uri: app.iconUri }} />` with fallbacks across Home, Stats, Add App, and Settings screens.
  - [x] **Bug 2b: Screen Time Accuracy (Eliminated Inflation)**:
    - Removed `realtime_usage_` SharedPreferences addition from `BlackoutModule.kt` methods (`getTodayUsage`, `getDayUsageStats`, `getInstalledApps`). UI strictly displays `UsageStatsManager` foreground time.
    - In `BlackoutAccessibilityService.kt`, computed active session duration in-memory strictly for blocking logic without saving it to SharedPreferences.
  - [x] **Compilation & Verification**:
    - `npm run tsc` exited with 0 errors.
    - `./gradlew :app:compileDebugKotlin` passed in 28s.
    - `./gradlew installDebug` built and installed on connected device (`Infinix X6833B - 14`).

## What's Next / Pending
- App fully ready for user testing.
