# Active Context

## Current Status
- Completed Critical Bug Fixes & Live Notification Feature:
  1. Bug 1: Settings & Entire Phone Getting Locked:
     - In `BlackoutAccessibilityService.kt`, implemented a strict system filter before checking lock status: ignores `com.blackout.app`, `launcher`, `systemui`, `android.settings`, `packageinstaller`, `navigationbar`, `android`, `com.android.systemui`, and `com.android.settings`.
     - In `isAppBlocked`, enforced strict package name equality (`pkg == packageName`) checking `isLocked` or `usedTodayMs >= dailyLimitMs`.
  2. Bug 2: Screen Time Inflation:
     - `BlackoutModule.kt`: Implemented exact midnight calculation in `TimeZone.getDefault()` and used `UsageStatsManager.INTERVAL_DAILY` returning only `totalTimeInForeground` with zero real-time additions.
  3. Bug 3: Lock Screen Bypass (Rapid Opening):
     - Transformed the overlay into a Persistent Overlay attached to WindowManager ONCE in `onServiceConnected` with initial state `View.GONE` and `FLAG_NOT_TOUCHABLE`.
     - Showing the overlay is instant (0ms delay) by toggling `visibility = View.VISIBLE` and setting `FLAG_NOT_TOUCH_MODAL` with `setOnTouchListener { _, _ -> true }` consuming 100% of touches.
     - Hiding the overlay is instant (0ms delay) by toggling `visibility = View.GONE` and restoring `FLAG_NOT_TOUCHABLE`.
  4. Feature 4: Live Ongoing Notification for Locked Apps:
     - Added `POST_NOTIFICATIONS` permission to `AndroidManifest.xml`.
     - Created notification channel `blackout_channel` (Importance: Low).
     - Displays ongoing notification with app name, percentage progress bar, and remaining minutes. Automatically cancelled when leaving the locked app.
- Validated with `npm run tsc` (0 errors), `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL), and installed on device (`Infinix X6833B - 14`) via `./gradlew installDebug`. Persistent overlay and service verified active in logcat.

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

