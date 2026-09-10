# Active Context

## Current Status
- Completed Critical Bug Fixes (Overlay Glitch, Real-time Tracking, Icon URI & Screen Time):
  1. Bug 1 & 3: Apps Closing Instantly & Lock Screen Glitching:
     - `BlackoutAccessibilityService.kt`: Removed `performGlobalAction(GLOBAL_ACTION_HOME)` from all blocking code. When an app is blocked, it now remains running behind an untouchable full-screen overlay.
     - Added package deduplication check in `showBlockingOverlay`: if `overlayView != null` and current foreground package is already showing the overlay, do nothing to prevent glitching/infinite loops.
     - Added touch consumer (`setOnTouchListener { _, _ -> true }`) on the full-screen layout so touches cannot reach the locked app.
     - Fixed `removeBlockingOverlay` to safely remove the view from `WindowManager` and reset flags.
     - Fixed anti-uninstall protection on Settings/PackageInstaller: displays the full-screen blocking overlay without calling `GLOBAL_ACTION_BACK`.
  2. Bug 2a: App Icons Showing Alphabets Instead of Real Icons:
     - Root cause: Passing Base64 strings across the React Native bridge for all installed apps exceeded the 1MB Android IPC Binder buffer limit.
     - `BlackoutModule.kt`: Switched from Base64 strings to disk caching in `reactApplicationContext.cacheDir` (`icon_${pkg}.png`), returning lightweight `file://` URIs in `iconUri`.
     - `types/index.ts`, `nativeBridge.ts`, `storage.ts`, `AppContext.tsx`: Added `iconUri` support and hydration.
     - `HomeScreen.tsx`, `StatsScreen.tsx`, `AddAppScreen.tsx`, `SettingsScreen.tsx`: Render `<Image source={{ uri: app.iconUri }} />` with clean fallbacks.
  3. Bug 2b: Screen Time Inflation:
     - `BlackoutModule.kt`: Removed all `realtime_usage_` additions from `getTodayUsage`, `getDayUsageStats`, and `getInstalledApps`. UI now strictly reflects `UsageStatsManager.queryUsageStats()` matching Digital Wellbeing.
     - `BlackoutAccessibilityService.kt`: In `isAppBlocked`, computes active session duration in-memory (`baseUsage + currentSessionTime >= dailyLimitMs`) without writing back to SharedPreferences.
- Validated with `npm run tsc` (0 errors), `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL in 28s).
- Installed on device (`Infinix X6833B - 14`) via `./gradlew installDebug`.

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

