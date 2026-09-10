# Active Context

## Current Status
- Completed all 7 fixes in one pass:
  1. Fix 1: Theme Sync Bug (Manual to System Transition) — `AppContext.tsx` immediately syncs `sysScheme` with `Appearance.getColorScheme()` when selecting "system". `App.tsx` has no `key={effectiveTheme}`, and all theme polling intervals are eliminated.
  2. Fix 2: Screen Time Accuracy — Accessibility Service is used strictly for blocking. Screen time is queried via `UsageStatsManager.queryUsageStats(INTERVAL_DAILY)` starting from midnight device time with zero `queryEvents` loops, matching Digital Wellbeing exactly.
  3. Fix 3: App Icons (Black Boxes Fixed) — `BlackoutModule.kt` generates high-quality `iconBase64` for installed apps and daily statistics. `HomeScreen.tsx`, `StatsScreen.tsx`, and `AddAppScreen.tsx` render real app icons with `<Image source={{ uri: 'data:image/png;base64,' + app.iconBase64 }} />`.
  4. Fix 4: Add App Screen UI/UX — Moved "Step 2: Time Selector" inline directly beneath the selected app card inside the ScrollView loop. Replaced minute stepper with +/- 1 increments (`Math.max(0, minutes - 1)`, `Math.min(59, minutes + 1)`). Allowed 1-minute limits.
  5. Fix 5: 10-Second Countdown Overlay — `BlackoutAccessibilityService.kt` detects when an active app is within 10 seconds of its daily limit (`usedTodayMs >= dailyLimitMs - 10000`). Displays a high-contrast native countdown HUD (10, 9, 8...) over the screen; at 0, executes `GLOBAL_ACTION_HOME`, locks the app, and shows the Blackout lock overlay.
  6. Fix 6: Anti-Uninstall Protection — `BlackoutAccessibilityService.kt` intercepts `com.android.settings` and `com.google.android.packageinstaller` by checking `SecurityHelper.hasActiveLocks()`, performs `GLOBAL_ACTION_BACK`, and displays a blocking overlay stating "Modifying Settings is blocked while apps are locked."
  7. Fix 7: Midnight Reset Logic — Exact daily 12:00 AM `AlarmManager` alarm triggers `MidnightResetReceiver.kt`, clearing `usedTodayMs` and setting `isLocked = false` across all tracked apps.
- Validated with `npm run tsc` (clean) and `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL).
- Deployed and installed updated APK directly onto connected device (`Infinix X6833B - 14`).

## Key Files & Structure
- `App.tsx`: Root application with NativeWind v4 theme binding.
- `src/context/AppContext.tsx`: Real-time system theme event handling and usage synchronization.
- `src/screens/AddAppScreen.tsx`: Inline Step 2 time picker, 1-min increments, native icon display.
- `src/screens/HomeScreen.tsx` & `src/screens/StatsScreen.tsx`: Real app icons, accurate screen time display.
- `android/app/src/main/java/com/blackout/app/`:
  - `BlackoutAccessibilityService.kt`: App blocking, 10s countdown HUD, and Settings anti-uninstall protection.
  - `BlackoutModule.kt`: Pure `UsageStatsManager` usage querying and icon Base64 generation.
  - `SecurityHelper.kt`: Encrypted prefs, active lock verification, and 12:00 AM alarm scheduling.
  - `MidnightResetReceiver.kt`: Midnight alarm broadcast receiver.

