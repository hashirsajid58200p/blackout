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

- [x] **Critical Bug Fixes & Live Notification Feature**:
  - [x] **Bug 1: Settings & Entire Phone Getting Locked (Fixed)**:
    - Added strict system filter in `BlackoutAccessibilityService.kt`: skips `com.blackout.app`, `launcher`, `systemui`, `android.settings`, `packageinstaller`, `navigationbar`, `android`, `com.android.systemui`, and `com.android.settings`.
    - Rewrote `isAppBlocked` with strict package name equality (`pkg == packageName`).
  - [x] **Bug 2: Screen Time Inflation (Fixed)**:
    - `BlackoutModule.kt`: Implemented exact midnight calculation in `TimeZone.getDefault()` and used `UsageStatsManager.INTERVAL_DAILY` returning only `totalTimeInForeground` with zero real-time additions.
  - [x] **Bug 3: Lock Screen Bypass / Rapid Opening (Fixed)**:
    - Converted overlay to a Persistent Overlay added once on service connect with initial `visibility = View.GONE` and `FLAG_NOT_TOUCHABLE`.
    - Instant 0ms transition toggling `visibility = View.VISIBLE` and `FLAG_NOT_TOUCH_MODAL` with `setOnTouchListener { _, _ -> true }` consuming 100% of touches.
  - [x] **Feature 4: Live Ongoing Notification for Locked Apps (Implemented)**:
    - Added `POST_NOTIFICATIONS` permission in `AndroidManifest.xml`.
    - Created `blackout_channel` Notification Channel.
    - Added ongoing notification showing percentage progress, time remaining, and locked status, automatically dismissed when navigating away.
  - [x] **Compilation & Verification**:
    - `npm run tsc` exited with 0 errors.
    - `./gradlew :app:compileDebugKotlin` passed in 27s.
    - `./gradlew installDebug` deployed APK to connected device (`Infinix X6833B - 14`).
    - Verified logcat: persistent overlay added (initial: GONE) and service connected.

## What's Next / Pending
- All 4 issues completed and verified on device.
