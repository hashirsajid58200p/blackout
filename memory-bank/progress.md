# Progress Tracker

## Completed Features
- [x] **Audit Round 3 (Verified on Physical Device Infinix X6833B)**:
  - [x] **Phase 1 — Locks expire on live time**: Read `lockExpirationTimestamp` in `BlackoutAccessibilityService.isAppBlocked()` and `SecurityHelper.kt`. Expired apps immediately allowed without waiting for alarms or app reopen. Fixed OEM `transsion` launcher check bug. Broke JS one-way ratchet in `AppContext.fetchUsage`.
  - [x] **Phase 2 — Screen-time total system apps regression resolved**: Restored `FLAG_SYSTEM` filter strictly in `getDayUsageStats()` and `getWeeklyUsageStats()`. Kept `getInstalledApps()` unfiltered by system flag. Total usage matches Digital Wellbeing.
  - [x] **Phase 3 — Theme visual audit & live sync**: Verified high-contrast rendering across Light, Dark, and System modes with screenshots. Verified System -> Light -> System immediate sync and live OS theme toggle. Explicitly documented native lock overlay's intentional dark palette.
  - [x] **Phase 4 — Open-ended sweep & UI affordance**: Verified `unlockTrackedApp` / `unlockPackage` integration in `HomeScreen` and `SettingsScreen`. Added `elevation: 8` to FAB button.
  - [x] **Phase 5 — Full regression & build verification**: Passed `tsc` (0 errors), `expo export:embed` (2370 modules), and Gradle assembleDebug (clean build and install).

- [x] **Persistent Issues Fix Loop (Issues 1, 2, 3)**:
  - [x] **Issue 1 (Locked app premature unlock blocked)**: Enforced via `SecurityHelper.unlockPackage`, `StorageService.unlockTrackedApp`, and UI alerts. Locked apps cannot be unlocked before midnight across all paths, navigations, and app restarts. Unlock becomes available once lock period completes.
  - [x] **Issue 2 (Screen-time calculation & timing drift resolved)**: Root cause resolved in `BlackoutModule.kt` by removing `isSystem` discard filter on launchable pre-installed packages (Phone, Chrome, Calculator, Deskclock, etc.). Restored ~16m discrepancy without hardcoded offsets.
  - [x] **Issue 3 (Delayed lock until timer completes)**: Root cause resolved by using `initialUsageMs` as the baseline. Configured apps enter `MONITORED / TIMER RUNNING` ("ACTIVE") and only lock when elapsed usage >= configured limit.
  - [x] Verified on physical Android 14 test device (`Infinix_X6833B`).
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

- [x] **Targeted Fixes (Round 1 Baseline)**:
  - [x] Initial lock and overlay state machine
  - [x] Basic exclusion filter for system apps in usage stats

- [x] **Audit Round 2**:
  - [x] Phase 0: Reconcile native Android code copies
  - [x] Phase 1: Screen time accuracy
  - [x] Phase 2: Locked app backgrounding & overlay enforcement
  - [x] Phase 3: Theme desync from System mode
  - [x] Phase 4: Unfinished features & audit issues
  - [x] Phase 5: Full regression pass

- [x] **Visual Redesign Implementation (Vintage Minimalist)**:
  - [x] Design tokens, typography (Fraunces, Inter, IBM Plex Mono) and fonts
  - [x] Shared components, Onboarding, Permissions, Home, Add App, Stats, Settings, Blackout overlay
