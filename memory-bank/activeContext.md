# Active Context

## Current Status
- Completed Targeted Fixes for Background App Running & Screen Time Accuracy:
  1. Bug 1: Locked App Still Running Behind Overlay (Fixed):
     - In `BlackoutAccessibilityService.kt`, introduced `isTransitioningToHome` state machine flag and `hideOverlayRunnable`.
     - When an app is blocked, `overlayView?.visibility = View.VISIBLE` and `showOverlay(pkg)` are called immediately, `isTransitioningToHome` is set to `true`, and `performGlobalAction(GLOBAL_ACTION_HOME)` pushes the app to background, pausing foreground execution and stopping media/audio playback.
     - When home/launcher events fire, the overlay remains visible for 3 seconds (`mainHandler.postDelayed(hideOverlayRunnable, 3000)`) displaying the lock message before hiding smoothly, keeping the user on the home screen while the app is stopped in the background.
     - Updated `homeButton.setOnClickListener` to set `isTransitioningToHome = true`, trigger home, and safely hide the overlay after 500ms.
  2. Bug 2: Screen Time 20 Min Inflated (Fixed):
     - In `BlackoutModule.kt`, strictly excluded `selfPkg`, `"com.blackout.app"`, and packages starting with `"com.blackout"` in `getDayUsageStats`, `getInstalledApps`, and `getWeeklyUsageStats`.
     - Filtered out all system UI (`systemui`), launcher (`launcher`), navigation bar (`navigationbar`), and pure Android framework packages (`android`).
     - Ensured only pure `totalTimeInForeground` from `queryUsageStats(INTERVAL_DAILY)` is read, with zero `realtime_usage_` additions.
- Validated with `npm run tsc` (0 errors), `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL in 27s), and deployed to connected device (`Infinix X6833B - 14`) via `./gradlew installDebug`. App launched cleanly via `adb`.

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

