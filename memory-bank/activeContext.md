# Active Context

## Current Status
- Completed 5 enterprise-grade architectural fixes across Android Kotlin and React Native:
  1. Screen-time tracking rewrite: Live elapsed session tracking via `BlackoutAccessibilityService` with deltas in `BlackoutUsagePrefs`, combined with historical `UsageStatsManager` fallback, polling every 5s.
  2. App listing filters: Authoritative `ApplicationInfo.FLAG_SYSTEM` checks via `PackageManager` to filter out system utilities (Settings, Calculator, etc.) and complete removal of hardcoded fallback mock arrays.
  3. Real-time theme sync: Native `onConfigurationChanged` emission in `MainActivity.kt` and `NativeEventEmitter` listener in `AppContext.tsx` for instantaneous Quick Settings synchronization.
  4. Enterprise anti-uninstall protection: Immediate `GLOBAL_ACTION_BACK` intercept and full-screen blocking overlay on `com.android.settings` and package installers while any app is locked.
  5. Automated midnight reset: `AlarmManager` exact midnight alarm (`12:00 AM`) and `MidnightResetReceiver` clearing daily usage totals and reset locked flags.
- Both `npm run tsc` and `./gradlew :app:compileDebugKotlin` pass with zero errors.

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
