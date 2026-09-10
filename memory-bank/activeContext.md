# Active Context

## Current Status
- Completed Surgical Rescue Fixes for Screen Time Inflation & Overlay Blinking:
  1. Bug 1: Screen Time Inflation (Fixed):
     - Completely removed `getForegroundUsageStatsMap` and any manual math from `BlackoutModule.kt`.
     - Rewrote `getTodayUsage`, `getInstalledApps`, `getDayUsageStats`, and `getWeeklyUsageStats` to query `UsageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime)` directly and read `totalTimeInForeground` from Android.
     - Filtered out non-launchable system apps in `getDayUsageStats` so system background processes are never counted as user screen time.
  2. Bug 2: Overlay Blinking & App Running Behind (Fixed):
     - In `BlackoutAccessibilityService.kt`, added `if (pkg == "com.blackout.app" || pkg.startsWith("com.blackout")) return` at the very top of `onAccessibilityEvent` to completely eliminate the infinite loop caused by overlay window events.
     - Added `isHomeOrLauncher` check to cleanly hide the overlay when the user returns to the home screen or settings.
     - When an app is blocked, `showOverlay(pkg)` is displayed immediately, and `performGlobalAction(GLOBAL_ACTION_HOME)` is invoked to stop foreground execution and audio playback.
     - Synchronized overlay visibility operations directly on the main thread and ensured touch events are 100% intercepted by the overlay.
- Validated with `npm run tsc` (0 errors), `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL in 26s), and deployed to connected device (`Infinix X6833B - 14`) via `./gradlew installDebug`. App launched cleanly via `adb`.

## Key Files & Structure
- `App.tsx`: Root application with NativeWind v4 theme binding.
- `src/context/AppContext.tsx`: 3-second usage polling, icon hydration, and locked app state synchronization.
- `src/screens/AddAppScreen.tsx`: Inline Step 2 time picker, 1-min increments, real native icon rendering.
- `src/screens/HomeScreen.tsx` & `src/screens/StatsScreen.tsx`: Real app icons, accurate screen time and countdown display.
- `android/app/src/main/java/com/blackout/app/`:
  - `BlackoutAccessibilityService.kt`: Real-time session tracking, 1-sec continuous monitor, app blocking, 10s countdown HUD, Settings anti-uninstall protection, and midnight reset.
  - `BlackoutModule.kt`: Base + real-time usage querying, 96x96 Base64 icon generation.
  - `SecurityHelper.kt`: Encrypted prefs, BlackoutPrefs sync, active lock verification, and 12:00 AM alarm scheduling.
  - `MidnightResetReceiver.kt`: Midnight alarm broadcast receiver.

