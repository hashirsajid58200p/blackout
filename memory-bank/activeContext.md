# Active Context

## Current Status
- Completed Surgical Regression Fixes:
  1. Bug 1: Lock Screen Blinking/Glitching (Infinite Loop):
     - Added `currentLockedPackage: String?` state tracking in `BlackoutAccessibilityService.kt`.
     - Rewrote `onAccessibilityEvent` to ignore window state events dispatched by the overlay itself (`com.blackout.app` where `className != MainActivity`).
     - Removed overlay only when user navigates to Home / Launcher (`isSystemOrHome`) or an unblocked app.
     - Protected `showOverlay` and `foregroundMonitorRunnable` with `!isOverlayShowing || currentLockedPackage != packageName` to eliminate rapid teardown and re-addition cycles.
     - Intercepted all touches using full-screen `FLAG_NOT_TOUCH_MODAL or FLAG_LAYOUT_IN_SCREEN` with `setOnTouchListener { _, _ -> true }`.
  2. Bug 2: Icons Showing Alphabets (Especially Stats Screen):
     - `BlackoutModule.kt`: Implemented explicit 96x96 PNG disk caching in `reactApplicationContext.cacheDir` for `getDayUsageStats` and `getInstalledApps`, returning valid `file://` URIs in `iconUri`.
     - `StatsScreen.tsx`: Fixed `dayApps` mapping for `selectedDayOffset === 0` to preserve `iconUri` and `iconBase64` from `todayDeviceUsage`.
  3. Bug 3: Screen Time Inflation:
     - `BlackoutModule.kt`: Strictly uses `UsageStatsManager.queryUsageStats()` without real-time SharedPreferences additions.
     - `BlackoutAccessibilityService.kt`: Calculates live active session time strictly in-memory for blocking logic without saving it to SharedPreferences.
- Validated with `npm run tsc` (0 errors), `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL in 31s), and installed on device (`Infinix X6833B - 14`) via `./gradlew installDebug`. App launched via ADB.

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

