# Active Context

## Current Status
- Completed Critical Bug Fixes (Bug 1 & Bug 2):
  1. Bug 1: Real-Time Usage Tracking & Blocking Fix:
     - `BlackoutAccessibilityService.kt`: Added real-time tracking via `currentForegroundPackage`, `currentSessionStartTime`, `sessionUsageMap`, and `saveRealTimeUsage` saving to `BlackoutPrefs`. Added a 1-second foreground monitor runnable to track active continuous sessions in real time and trigger immediate lock + 10s countdown if daily limit is reached while actively using an app.
     - `BlackoutAccessibilityService.kt`: Rewrote `isAppBlocked` to sum `baseUsage` (from synced JSON) + `realTimeUsage` (from `BlackoutPrefs` including active session elapsed time). Added `resetDailyUsage()` clearing `realtime_usage_` keys.
     - `BlackoutModule.kt`: Rewrote `getTodayUsage` to combine `UsageStatsManager.queryUsageStats` base + `realtime_usage_$packageName` (+ live delta if currently active in foreground). Updated `syncLockedAppsToNative` to write to both `SecurityHelper` and `BlackoutPrefs`.
     - `SecurityHelper.kt`: Updated `saveLockedApps` and `resetMidnightLocks` to mirror `locked_apps_json` to `BlackoutPrefs` and invoke `resetDailyUsage()`.
     - `AppContext.tsx`: Changed usage polling interval from 5000ms to 3000ms, and ensured `syncLockedAppsToNative` runs on all usage updates.
  2. Bug 2: App Icons Display Fix:
     - `BlackoutModule.kt`: In `getInstalledApps` and `getAppIconBase64`, extracted 96x96 PNG ARGB_8888 bitmap at 100% quality into Base64, and guaranteed `iconBase64` is always present in output map.
     - `HomeScreen.tsx`, `StatsScreen.tsx`, and `AddAppScreen.tsx`: Updated fallback views when an icon is absent to `bg-gray-200 dark:bg-gray-700` and letter styling `text-lg font-bold text-gray-500 dark:text-gray-400`.
     - `AppContext.tsx`: Hydrates missing `iconBase64` on existing `trackedApps` from `NativeBridge.getInstalledApps()` on load.
- Validated with `npm run tsc` (clean) and `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL).
- Deployed and installed updated APK directly onto connected device (`Infinix X6833B - 14`).

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

