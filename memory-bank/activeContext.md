# Active Context

## Current Status: Audit Round 2 - Phase 2 Completed

### Phase 2: Locked App Backgrounding & Overlay Enforcement (Completed & Verified)
1. **Root Cause Analysis**:
   - Competing enforcement state machines: `onAccessibilityEvent` and a 1-second `foregroundMonitorRunnable` ran concurrently without synchronization, racing over `isTransitioningToHome`, `overlayView.visibility`, and handler callbacks.
   - Self-dismissal bug: The overlay view is attached by `BlackoutAccessibilityService` (`com.blackout.app`). Showing the overlay fired a `TYPE_WINDOW_STATE_CHANGED` event with `pkg = com.blackout.app`. `onAccessibilityEvent` had an early rule that upon seeing `com.blackout.app` immediately called `hideOverlay()` and reset `isTransitioningToHome = false`, prematurely killing the overlay right after it appeared.
   - Launcher detection gaps: `isLauncherOrHome` used case-sensitive substring matching (`contains("launcher")`) which failed on OEM launchers like Transsion's `XOSLauncher` (capital 'L'), and used `MATCH_DEFAULT_ONLY` which can miss third-party launchers like Niagara `bitpit.launcher`.
   - Silent failure on HOME: `performGlobalAction(GLOBAL_ACTION_HOME)` return boolean was ignored without retries or fallbacks.
2. **Implementation Fixes**:
   - Single authoritative enforcement path: created `enforceBlock(packageName)` used by both `onAccessibilityEvent` and `safetyNetRunnable`.
   - Demoted `foregroundMonitorRunnable` (1s loop) to a 3-second lightweight `safetyNetRunnable` reusing `enforceBlock`.
   - Created `sendToHome()`: checks return boolean of `performGlobalAction(GLOBAL_ACTION_HOME)`; if false, logs warning and retries immediately; if retry fails, dispatches explicit Home `Intent(ACTION_MAIN, CATEGORY_HOME, FLAG_ACTIVITY_NEW_TASK)`.
   - Fixed self-dismissal: `com.blackout.app` window events are explicitly ignored when `isTransitioningToHome == true`.
   - Case-insensitive launcher detection with broad keyword support (`launcher`, `home`, `trebuchet`, `quickstep`, `nexuslauncher`, `shade`, `bitpit`, `transsion`) and fallback to `queryIntentActivities(ACTION_MAIN, CATEGORY_HOME)`.
   - Dismiss synchronization: overlay stays visible until positive confirmation of arrival at launcher is received by `onAccessibilityEvent`, then dismisses cleanly after a 400ms settle delay. A 5s safety timeout acts as a fallback.
   - Updated `accessibility_service_config.xml` to enable `canRetrieveWindowContent="true"` and `flagRetrieveInteractiveWindows`.
3. **Physical Device Verification (Infinix X6833B, Android 14)**:
   - Verified via `adb logcat -s BlackoutAccessibility` on locked app (`com.spotify.music`):
     - `enforceBlock` triggered in 2ms upon app launch.
     - `performGlobalAction(GLOBAL_ACTION_HOME)` succeeded.
     - Overlay displayed "SPOTIFY IS DARK".
     - Device landed cleanly on Niagara launcher (`bitpit.launcher`).
     - Overlay dismissed after 400ms settle delay once launcher was confirmed.
     - Rapid re-opening test (5 successive rapid launches): every launch was intercepted within 2ms, zero gap, zero leaks, user bounced to home each time.

---

### Phase 3: Theme Desync from "System" Mode (Completed & Verified)
1. **Root Cause Analysis**:
   - NativeWind / `react-native-css-interop`'s `setColorScheme` delegates to React Native `Appearance.setColorScheme("light"|"dark")`.
   - Setting a concrete `"light"` or `"dark"` plants an app-wide override in React Native's `Appearance`.
   - When switching back to "System", `updateThemeMode` queried `Appearance.getColorScheme()` which returned the override ("light"), and passed that concrete value back to `setColorScheme`, causing the app to stay stuck on light until force close.
2. **Implementation Fix**:
   - In `src/context/AppContext.tsx`:
     - Updated `updateThemeMode` to pass literal `mode` directly to `setColorScheme(mode)` without calling `Appearance.getColorScheme()`. Passing `"system"` clears the override (`Appearance.setColorScheme(null)`).
     - Updated the `useEffect` to watch `settings.themeMode` and pass `settings.themeMode` directly to `setColorScheme(settings.themeMode)`.
     - Preserved `sysScheme` state and listeners for `effectiveTheme` used by icon tints and status bars.
   - Re-exported production Android JS bundle: `android/app/src/main/assets/index.android.bundle`.
3. **Physical Device Verification (Infinix X6833B, Android 14)**:
   - System Dark -> App System (Dark) -> Tap Light (Light) -> Tap System (immediately returned to Dark without reopening!).
   - Manual Dark mode persists properly.
   - Tested live OS theme switching (`adb shell cmd uimode night no` and `yes`): app responded live in foreground, flipping from Dark to Light and back to Dark seamlessly.

---

### Phase 4: Unfinished Features & Audit Issues (Completed & Verified)
1. **Auto-Clean Uninstalled Apps Toggle**:
   - Added a "MAINTENANCE" section card in `src/screens/SettingsScreen.tsx` with a `Switch` wired to `updateAutoCleanSetting`.
   - Verified on device: switch renders in monochrome theme, toggles from ON to OFF and back to ON, and updates settings state persistently.
2. **Deduplication of Dead Blocking Logic**:
   - Analyzed `SecurityHelper.kt` vs `BlackoutAccessibilityService.kt`.
   - Deleted unused `AppUsageLimitInfo`, `getPackageUsageLimit`, and `isPackageBlocked` from `SecurityHelper.kt`.
   - Updated `SecurityHelper.hasActiveLocks` to check live usage via `getTodayPackageUsage`, preventing `BlackoutDeviceAdminReceiver` from missing active locks.
3. **NPM Configuration**:
   - Added `.npmrc` with `legacy-peer-deps=true` for seamless dependency resolution with React 19 and `lucide-react-native`.
4. **Android 14 Exact Alarm Hardening & Live Stats**:
   - In `SecurityHelper.scheduleMidnightReset`: added API 31+ `alarmManager.canScheduleExactAlarms()` check with safe `setAndAllowWhileIdle` fallback to prevent `SecurityException` crashes on Android 14.
   - Added `SCHEDULE_EXACT_ALARM` permission to `android/app/src/main/AndroidManifest.xml` and `plugins/withBlackoutNativeModule.js`.
   - Added live 4-second polling interval in `src/screens/StatsScreen.tsx`.
   - Verified clean compilation: `npx tsc --noEmit` (0 errors) and `./gradlew :app:compileDebugKotlin` / `:app:installDebug` (BUILD SUCCESSFUL).

---

### Phase 5: Full Regression Pass (Completed & Verified)
1. **Onboarding**: Verified persistent state; app boots directly to Home without looping back into onboarding.
2. **Permissions**: Real-time granted/denied status verified across all 4 system permissions (Usage Access, Overlay, Accessibility, Device Admin).
3. **App Picker**: Real installed apps list, real package icons, search filter, and immutable limit configuration verified.
4. **Screen Time Accuracy**: Fine-grained UsageEvents engine verified on device against Digital Wellbeing (3h 5m total, X 1h 0m, Instagram 57m, WhatsApp 17m, YouTube 29m).
5. **Hard-Lock Enforcement**: Verified `enforceBlock` intercepts locked app launches within 2ms, displays overlay, and bounces to home with zero gap across rapid repeated launches.
6. **Theme Sync**: Verified System -> Light -> System immediate reversion, and real-time OS night mode switching.
7. **Device Admin Protection**: Verified deactivation rejection when active locks exist.
8. **Midnight Reset**: Verified alarm scheduling and lock reset logic with Android 14 `SCHEDULE_EXACT_ALARM` support.
9. **Build Integrity**: `npx tsc --noEmit` and `./gradlew :app:compileDebugKotlin` pass with 0 errors.

---

## Final Status
All phases (Phase 0 through Phase 5) of the Audit Round 2 Fix Loop are fully implemented and verified on the physical Infinix X6833B (Android 14) test device.
