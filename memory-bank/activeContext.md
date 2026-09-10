# Active Context

## Current Status
- Initial project codebase onboarding and deep-dive analysis completed.
- Codebase is cleanly structured with Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, and custom Android Kotlin native modules.
- TypeScript compiler (`npm run tsc`) passes with zero diagnostics/errors.
- Git working directory is clean on `main` branch.

## Key Files & Structure
- `App.tsx`: Root application with `SafeAreaProvider`, `AppProvider`, and screen router.
- `src/screens/`:
  - `HomeScreen.tsx`: Circular multi-segment monochrome usage donut chart, today's focus summary, active locks list, FAB for adding locks.
  - `AddAppScreen.tsx`: Installed app listing/search, custom app lock input, hours/minutes duration selector, confirmation modal.
  - `StatsScreen.tsx`: Weekly screen time bar chart, day navigation carousel, daily per-app usage breakdown.
  - `SettingsScreen.tsx`: Theme switcher (system/light/dark), Device Admin uninstall protection toggle, active lock viewer, permission overview.
  - `PermissionsScreen.tsx`: Live check & intent launchers for Usage Access, Overlay, Accessibility, and Device Admin.
  - `OnboardingScreen.tsx`: Introduction slider explaining the Monolith Minimalist philosophy and immutable limits.
  - `BlackoutScreen.tsx`: Full-screen lock display ("Application IS DARK").
- `src/services/`:
  - `nativeBridge.ts`: Bridge layer calling native Kotlin methods with TypeScript fallbacks.
  - `storage.ts`: Storage service handling AsyncStorage persistence and midnight reset.
- `src/context/AppContext.tsx`: Global context managing app state, live system theme detection, and background usage polling.
- `android/app/src/main/java/com/blackout/app/`:
  - `BlackoutAccessibilityService.kt`: Native accessibility service intercepting window transitions and enforcing overlays.
  - `BlackoutModule.kt`: React Native module querying Android `UsageEvents` and handling device admin/permission actions.
  - `BlackoutDeviceAdminReceiver.kt`: Receiver handling Device Administrator activation/deactivation.

## Next Steps
- Waiting for user instruction on the next feature, optimization, or bug fix.
