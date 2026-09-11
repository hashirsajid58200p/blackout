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

## Next Phase
- **Phase 3 — Theme desync from "System" mode after manual override**:
  - Exact root cause identified in prompt: `nativewind` / `react-native-css-interop`'s `setColorScheme` delegates to React Native `Appearance.setColorScheme`. Passing concrete `"light"` or `"dark"` plants an app-wide override.
  - When user switches back to "System", `updateThemeMode` in `src/context/AppContext.tsx` currently queries `Appearance.getColorScheme()`, which returns the override planted previously, and calls `setColorScheme(concrete)`.
  - Fix: Never resolve `"system"` to a concrete value. Pass literal `"system"` directly to `setColorScheme("system")` (clearing RN override), and in the `useEffect` pass `settings.themeMode` directly.
  - Test live theme switching on physical device.

## Manual Checks for Founder
- Try opening Spotify (which has an active lock): observe instant redirection to Home screen with "SPOTIFY IS DARK" overlay.
- Rapidly tap Spotify multiple times: observe that it bounces back immediately with zero leak.
- Open Blackout: verify Home dashboard and Stats screen remain clean and responsive.
