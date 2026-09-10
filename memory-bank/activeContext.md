# Active Context

## Current Status
- Executed critical rescue mission resolving all 3 UI and tracking bugs:
  1. UI Freeze & Infinite Theme Loop: Removed `key={effectiveTheme}` from root View in `App.tsx` and removed interval polling in `AppContext.tsx`. NativeWind v4 controls dark mode seamlessly without unmounting the React tree.
  2. Screen Time Inflation: Removed Accessibility Service time delta accumulation. Replaced with pure `UsageStatsManager.queryUsageStats(INTERVAL_DAILY)` in `BlackoutModule.kt` (exact Digital Wellbeing API) and deleted all `queryEvents` loops.
  3. Navigation & Context Stability: Added 1000ms update delta threshold in `AppContext.tsx` background usage interval to prevent unnecessary re-renders and JS thread freezing.
- Both `npm run tsc` and `./gradlew :app:compileDebugKotlin` pass with zero errors.
- Debug APK successfully built and installed on connected device (`Infinix X6833B - 14`).

## Key Files & Structure
- `App.tsx`: Root application cleanly driven by NativeWind v4 `setColorScheme(effectiveTheme)`.
- `src/services/nativeBridge.ts`: Bridge to native Kotlin APIs with error logging and zero fake fallbacks.
- `src/context/AppContext.tsx`: Real-time system theme event handling and 5s usage polling loop.
- `android/app/src/main/java/com/blackout/app/`:
  - `BlackoutAccessibilityService.kt`: Real-time window state delta accumulation, overlay enforcement, and Settings anti-uninstall intercept.
  - `BlackoutModule.kt`: Real-time + historical usage resolution, system app filtering in `getInstalledApps`.
  - `MidnightResetReceiver.kt`: BroadcastReceiver for exact 12:00 AM daily reset of usage and locks.
  - `SecurityHelper.kt`: SharedPreferences security, active lock checks, and AlarmManager midnight scheduling.
  - `MainActivity.kt`: `onConfigurationChanged` emitting `onSystemThemeChanged`.

## Next Steps
- Deliver walkthrough and summary to user.
