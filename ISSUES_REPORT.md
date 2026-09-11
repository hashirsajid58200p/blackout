# Issues Report — September 11, 2026 (Run 2 — UI Responsiveness & Edge-Sticking Audit)

## Summary
- Critical: 0 | High: 3 | Medium: 8 | Low: 8
- Device tested: Infinix X6833B (Infinix NOTE 30), Android 14 (API level 34), Resolution 1080x2460
- Build status: clean (TypeScript: clean 0 errors; Gradle: clean assembleDebug in 28s; ADB install: clean)

## Issues

### ISSUE-01 — Past Days Historical Screen Time Inflation (`INTERVAL_BEST` Bucket Leak)
- Category: Bug
- Severity: High
- File(s): `android/app/src/main/java/com/blackout/app/BlackoutModule.kt` (lines 427–458, 504–516)
- Description: When viewing past days on the Stats screen (such as selecting Monday or earlier days in the 7-day strip), the displayed screen time figures are severely inflated. On Monday Sep 7, total screen time displays as 53.9h for a single 24-hour day, with individual apps like Instagram registering 27h 30m. This inflation cascades into the 7-day daily average calculation, reporting an impossible 16.8h/day.
- Steps to Reproduce:
  1. Launch Blackout on a real Android device with past usage history.
  2. Tap the "Stats" tab in the bottom navigation bar.
  3. In the 7-day calendar bar ("M T W T F S S"), tap Monday (or any earlier day index `i < 6`).
  4. Inspect the "Total Screen Time" metric and the individual app breakdown below.
- Evidence: Live screen capture `screen_stats_monday.png` demonstrates:
  - Monday Sep 7: `53.9h` Total Screen Time
  - Daily Average: `16.8h`
  - Instagram: `27h 30m`
- Suspected Root Cause: In `BlackoutModule.kt`, today's usage (`dayOffset == 0`) uses `getTodayUsageEventsMap()` which aggregates exact foreground/background timestamps from `UsageEvents`. However, for past days (`i < 6`), both `getWeeklyUsageHistory` and `getUsageStatsForDateRange` execute:
  ```kotlin
  val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_BEST, startTime, endTime)
  ```
  On Android, `INTERVAL_BEST` instructs the OS to return whatever pre-aggregated intervals are available (often `INTERVAL_WEEKLY` or `INTERVAL_MONTHLY`). In those aggregated records, `totalTimeInForeground` spans the entire multi-day aggregation window rather than the requested daily slice, crediting an entire week of usage to a single day.

---

### ISSUE-02 — Android System Back Button/Gesture Minimizes and Exits App
- Category: Bug
- Severity: High
- File(s): `src/context/AppContext.tsx` (lines 13–36), `App.tsx` (lines 32–52), `android/app/src/main/java/com/blackout/app/MainActivity.kt`
- Description: Pressing the Android hardware or virtual back button or performing an edge back swipe gesture on any subscreen (`AddAppScreen`, `SettingsScreen`, `StatsScreen`, or `PermissionsScreen`) immediately minimizes Blackout and sends the user back to the Android launcher home screen, rather than returning to the previous screen or Home.
- Steps to Reproduce:
  1. Open Blackout on the device.
  2. Tap the "+" button on the Home screen to enter `AddAppScreen` (or tap "PERMISSIONS REQUIRED" to enter `PermissionsScreen`).
  3. Press the Android system back button or execute `adb shell input keyevent 4`.
  4. Notice the app is immediately backgrounded and the launcher desktop appears.
- Evidence: Captured during QA via `adb shell input keyevent 4` while on `PermissionsScreen`; window dump confirmed focus immediately shifted to launcher:
  `mCurrentFocus=Window{... com.transsion.hilauncher/com.transsion.hilauncher.WorkspaceLauncher}` (`screen_after_back.png`).
- Suspected Root Cause: Blackout uses custom React state navigation (`currentScreen` in `AppContext.tsx`) without React Navigation or a registered React Native `BackHandler` listener (`BackHandler.addEventListener('hardwareBackPress', ...)`). Consequently, the native Android activity handles the back press via default `MainActivity.onBackPressed()`, which minimizes the task to background.

---

### ISSUE-03 — Missing `RECEIVE_BOOT_COMPLETED` Permission Disables Midnight Alarm Re-arm on Reboot
- Category: Config / Bug
- Severity: High
- File(s): `android/app/src/main/AndroidManifest.xml` (lines 39–43), `plugins/withBlackoutNativeModule.js` (lines 13–19), `android/app/src/main/java/com/blackout/app/MidnightResetReceiver.kt` (lines 14–20)
- Description: `MidnightResetReceiver` is declared in the manifest with an intent filter for `android.intent.action.BOOT_COMPLETED` to reschedule the 12:00 AM daily reset alarm whenever the phone restarts. However, the manifest fails to declare `android.permission.RECEIVE_BOOT_COMPLETED`. Without this permission, Android drops the boot broadcast, preventing the midnight alarm from ever being rescheduled upon device restart.
- Steps to Reproduce:
  1. Inspect `android/app/src/main/AndroidManifest.xml` lines 1–12 and 39–43.
  2. Notice `MidnightResetReceiver` handles `BOOT_COMPLETED`:
     ```xml
     <receiver android:name="com.blackout.app.MidnightResetReceiver" android:exported="false">
       <intent-filter>
         <action android:name="android.intent.action.BOOT_COMPLETED"/>
       </intent-filter>
     </receiver>
     ```
  3. Check `<uses-permission>` tags in the manifest and `plugins/withBlackoutNativeModule.js`.
- Evidence: Static search confirms `android.permission.RECEIVE_BOOT_COMPLETED` is absent from both `AndroidManifest.xml` and `plugins/withBlackoutNativeModule.js` `permissionsToAdd`.
- Suspected Root Cause: Android security guidelines mandate that any application listening for `BOOT_COMPLETED` must explicitly hold `android.permission.RECEIVE_BOOT_COMPLETED`. Since exact `AlarmManager` alarms are discarded by the Android kernel on shutdown/reboot, all daily limit resets and scheduled unblocks will permanently fail after a device reboot until the user manually relaunches Blackout.

---

### ISSUE-04 — Add App "Custom Lock" Feature Generates Non-Functional Placebo Entries
- Category: Incomplete Feature
- Severity: Medium
- File(s): `src/screens/AddAppScreen.tsx` (lines 59–69, 300–389), `src/context/AppContext.tsx` (line 268), `src/services/storage.ts` (lines 112, 142)
- Description: In `AddAppScreen`, entering any query into the search bar that doesn't match an installed app presents an interactive button: `+ ADD CUSTOM LOCK: '<NAME>'`. Clicking it creates a tracked card with a synthetic package name `custom.<name>`. However, this item cannot track usage (displays 0m permanently), cannot match any foreground window in `BlackoutAccessibilityService.kt`, and cannot be blocked or limited.
- Steps to Reproduce:
  1. Navigate to Add App screen (+).
  2. Type any arbitrary text in the search input (e.g. "Test").
  3. Tap "+ ADD CUSTOM LOCK: 'TEST'".
  4. Notice the app confirms and navigates back to Home with a new "TEST" card.
  5. Attempt to lock it or set a daily limit.
  6. Notice it never tracks usage, never accumulates time, and cannot be intercepted by the native accessibility service.
- Evidence: Captured in screenshots `screen_custom_lock_tapped.png` and `screen_home_returned.png`. In `AppContext.tsx:268`:
  ```typescript
  if (app.packageName.startsWith("custom.")) {
    return app; // Custom locks don't have usage stats
  }
  ```
- Suspected Root Cause: The custom lock UI was designed as a prototype (likely for future website or keyword blocking), but native blocking in `BlackoutAccessibilityService.kt` strictly inspects `event.packageName.toString()`. Synthetic packages like `custom.test` do not correspond to any Android application package or browser URL parser, rendering the feature an inoperable stub.

---

### ISSUE-05 — False "PERMISSIONS REQUIRED" and "0m Total Usage" Flash on Cold Launch / App Resume
- Category: UI
- Severity: Medium
- File(s): `src/context/AppContext.tsx` (lines 69–80), `src/screens/HomeScreen.tsx` (lines 178–194)
- Description: Every time Blackout is cold-launched or resumed from the background, the Home screen immediately renders a bright red error banner reading "PERMISSIONS REQUIRED" and displays "0m Total Screen Time", even when all 4 permissions are already granted and substantial usage exists. After ~500ms–1000ms, the banner disappears and the numbers abruptly jump to their real values.
- Steps to Reproduce:
  1. Grant all 4 required permissions on the device.
  2. Force stop or background Blackout.
  3. Re-open Blackout and observe the initial frame.
- Evidence: Real device capture at cold launch (`screen_reopen.png`) shows:
  - Header badge: `PERMISSIONS REQUIRED` (red background)
  - Card metric: `0m Total Screen Time`
  A subsequent capture 1.5 seconds later (`screen_reopen_after2s.png`) shows:
  - Header badge: Gone
  - Card metric: `5h 17m Total Screen Time`
- Suspected Root Cause: In `AppContext.tsx`, initial state for `permissions` is initialized to all `false`:
  ```typescript
  const [permissions, setPermissions] = useState<NativePermissionsStatus>({
    usageStats: false,
    overlay: false,
    accessibility: false,
    deviceAdmin: false,
  });
  ```
  `HomeScreen.tsx` evaluates `hasMissingPermissions` synchronously on the first render before the asynchronous bridge call `NativeBridge.checkPermissions()` resolves, causing an unstyled layout shift and alarming the user with false error banners.

---

### ISSUE-06 — Orphaned and Unreachable `BlackoutScreen.tsx` Component
- Category: Incomplete Feature
- Severity: Low
- File(s): `src/screens/BlackoutScreen.tsx`, `src/context/AppContext.tsx` (lines 13, 75), `App.tsx` (line 50)
- Description: `BlackoutScreen.tsx` is maintained as a registered screen in `ScreenType` and rendered in `App.tsx` when `currentScreen === 'blackout'`. However, nowhere in the entire codebase is `setCurrentScreen('blackout')` ever invoked, nor is `activeBlockApp` ever populated by any event.
- Steps to Reproduce:
  1. Search the entire codebase for `setCurrentScreen('blackout')` or setters of `activeBlockApp`.
  2. Note that zero callers exist in any component or service.
- Evidence: `grep -rn "setCurrentScreen" src/` confirms transitions exist solely between `home`, `stats`, `settings`, `addApp`, `onboarding`, and `permissions`.
- Suspected Root Cause: An architectural evolution occurred: app blocking was initially prototyped as an in-app React Native view, but was later replaced by a native system-level WindowManager overlay in `BlackoutAccessibilityService.kt` to ensure bulletproof interception across the Android OS. The React Native `BlackoutScreen.tsx` was left behind as orphaned dead code.

---

### ISSUE-07 — Inconsistent Permission Count String Between Settings and Home
- Category: UI
- Severity: Low
- File(s): `src/screens/SettingsScreen.tsx` (lines 303–305), `src/screens/HomeScreen.tsx` (line 178), `src/screens/PermissionsScreen.tsx` (lines 28–80)
- Description: The permissions banner on `HomeScreen` states `ALL 4 PERMISSIONS GRANTED` and `PermissionsScreen` correctly lists 4 distinct permissions (`Usage Access`, `Accessibility Service`, `Display Over Other Apps`, `Device Admin`). However, `SettingsScreen.tsx` hardcodes the label: `ALL 3 PERMISSIONS GRANTED`.
- Steps to Reproduce:
  1. Grant all 4 permissions on the test device.
  2. Confirm `HomeScreen` displays "ALL 4 PERMISSIONS GRANTED".
  3. Tap the Settings icon to open `SettingsScreen` and scroll to "SYSTEM INTEGRATION & STATUS".
  4. Read the status text under "SYSTEM PERMISSIONS".
- Evidence: Real device capture `screen_settings_scrolled.png` shows:
  ```
  SYSTEM PERMISSIONS
  ALL 3 PERMISSIONS GRANTED
  ```
- Suspected Root Cause: In `SettingsScreen.tsx`:
  ```typescript
  {permissions.usageStats && permissions.overlay && permissions.accessibility
    ? "ALL 3 PERMISSIONS GRANTED"
    : "ACTION REQUIRED — TAP TO REVIEW"}
  ```
  The string was hardcoded when Blackout only required 3 permissions, prior to the addition of `deviceAdmin` as a 4th security layer, and was never updated to reflect `permissions.deviceAdmin`.

---

### ISSUE-08 — Countdown Overlay Native View Uses Deprecated Zinc Colors Instead of Vintage Minimalist Palette
- Category: UI
- Severity: Low
- File(s): `android/app/src/main/java/com/blackout/app/BlackoutAccessibilityService.kt` (lines 670, 678, 700)
- Description: The native countdown warning overlay view (`showCountdownOverlay`) created via Android WindowManager uses hardcoded legacy zinc colors (`#EE09090B`, `#EF4444`, `#D4D4D8`) instead of the Monolith/Vintage Minimalist design tokens (`#1B1712` espresso, `#B23A2E` stamp-red, `#EDE4D3` bone).
- Steps to Reproduce:
  1. Inspect `showCountdownOverlay` in `BlackoutAccessibilityService.kt`.
  2. Check lines 670, 678, 699–700:
     ```kotlin
     layout.setBackgroundColor(Color.parseColor("#EE09090B"))
     tagText.setTextColor(Color.parseColor("#EF4444"))
     subText.setTextColor(Color.parseColor("#D4D4D8"))
     ```
  3. Compare against `showNativeLockOverlay` which was updated to use `#1B1712` and `#B23A2E`.
- Evidence: Verbatim lines in `BlackoutAccessibilityService.kt:670, 678, 700`.
- Suspected Root Cause: During the Vintage Minimalist design refactor (Phase 7), `showNativeLockOverlay` was re-themed with the warm bone and espresso palette, but the secondary warning overlay `showCountdownOverlay` was overlooked.

---

### ISSUE-09 — Dead Code, Stale Handlers, and Unused Lucide Icons
- Category: Bug / Code Quality
- Severity: Low
- File(s): `src/screens/AddAppScreen.tsx` (lines 8, 47–57), `src/screens/SettingsScreen.tsx` (line 8), `src/components/NavigationHeader.tsx` (lines 6–7), `src/components/BottomNavBar.tsx` (lines 6–7)
- Description: Multiple components import unused Lucide icons, declare dead helper functions, or maintain unused state:
  - `src/screens/AddAppScreen.tsx`: `getIcon()` (lines 47–57) is defined but never invoked; `Camera`, `Video`, `MessageSquare`, `Globe`, `Gamepad2` are imported but unused.
  - `src/screens/SettingsScreen.tsx`: `Unlock` is imported from `lucide-react-native` but never rendered.
  - `src/components/NavigationHeader.tsx`: `Calendar`, `Settings as SettingsIcon` are imported but unused.
  - `src/components/BottomNavBar.tsx`: `ShieldAlert` is imported but unused.
- Steps to Reproduce:
  1. Run static import analysis on the files listed.
  2. Check references to `getIcon` in `AddAppScreen.tsx`.
- Evidence: Line 47 of `AddAppScreen.tsx`: `const getIcon = (appName: string) => { ... }` has 0 usages within the file.
- Suspected Root Cause: Iterative UI updates replaced placeholder iconography with native app icon bitmaps and simplified navigation elements without cleaning up obsolete imports and helpers.

---

### ISSUE-10 — Inexact Alarm Fallback Missing on `SecurityException` During Midnight Reset Scheduling
- Category: Performance / Bug
- Severity: Medium
- File(s): `android/app/src/main/java/com/blackout/app/SecurityHelper.kt` (lines 135–151)
- Description: On Android 12+ (API 31+), `AlarmManager.setExactAndAllowWhileIdle` requires exact alarm scheduling authorization. Although Blackout checks `alarmManager.canScheduleExactAlarms()`, on certain Android 13+ OEM distributions (MIUI, ColorOS, Transsion/Infinix), exact alarms can be revoked dynamically by the OS under aggressive battery management, or `setExactAndAllowWhileIdle` can throw a `SecurityException`. In `SecurityHelper.kt`, the exception is caught and logged, but no fallback inexact alarm (`setAndAllowWhileIdle` or `WorkManager`) is scheduled, leaving the app without any midnight reset mechanism until relaunch.
- Steps to Reproduce:
  1. Inspect `SecurityHelper.kt` lines 135–151.
  2. Observe that if an exception is thrown inside the `try` block, the `catch (e: Exception)` block only logs `Failed to schedule midnight reset alarm`.
- Evidence: Verbatim excerpt in `SecurityHelper.kt:148–150`:
  ```kotlin
  } catch (e: Exception) {
      Log.e(TAG, "Failed to schedule midnight reset alarm", e)
  }
  ```
- Suspected Root Cause: Omission of a resilient fallback in the error handler to schedule a non-exact wakeup alarm or enqueue an expedited `OneTimeWorkRequest` when exact alarm scheduling fails.

---

### ISSUE-11 — Dynamic Permission Revocation Not Reflected Without Full Background-to-Foreground Transition
- Category: Bug
- Severity: Medium
- File(s): `src/context/AppContext.tsx` (lines 120–136)
- Description: If an accessibility service or usage stats permission is revoked while Blackout is open in split-screen, picture-in-picture, or floating window mode, or disabled via Android Quick Settings without the app changing `AppState` to background, the React state continues to indicate that permissions are granted until the user explicitly minimizes and restores the application.
- Steps to Reproduce:
  1. Launch Blackout in multi-window / split-screen mode alongside Android System Settings.
  2. Disable Blackout Accessibility Service from System Settings.
  3. Look at Blackout's Home screen; the status continues to show secured until the app loses and regains window focus.
- Evidence: In `AppContext.tsx`, `refreshPermissions()` is attached exclusively to `AppState.addEventListener('change', ...)` and initial mount.
- Suspected Root Cause: Absence of periodic polling or an explicit native event callback dispatched by `BlackoutAccessibilityService.onServiceConnected()` / `onUnbind()` to React Native when the service connection state changes.

---

### ISSUE-12 — Unresponsive Extremity Sticking (`justify-between`) on 7-Day Activity Header in StatsScreen
- Category: UI
- Severity: Medium
- File(s): `src/screens/StatsScreen.tsx` (lines 200–210)
- Description: In `StatsScreen`, the "7-Day Activity" bar chart card header is constructed using `<View className="flex-row items-center justify-between mb-4 pb-2 border-b border-hairline dark:border-hairline-dark">`. The left element (BarChart2 icon + "7-DAY ACTIVITY") and the right element ("117.5H TOTAL") are pinned hard to opposite extremities of the container without internal horizontal insets relative to the border-bottom separator line. On smaller devices (320px–360px width) or when system accessibility font scaling is enlarged, the elements crowd the card's boundaries and risk colliding with each other because neither container has responsive flex-shrink constraints or proportional padding.
- Steps to Reproduce:
  1. Open Blackout and navigate to the "Stats" tab.
  2. Inspect the 7-Day Activity card.
  3. Notice that "7-DAY ACTIVITY" touches the far left edge of the border-bottom line and "117.5H TOTAL" is pressed against the far right edge without breathing room.
  4. On narrow screen sizes or high DPI font scaling, the text wraps or touches borders awkwardly.
- Evidence: Visual capture in `screen_stats.png` and `screen_stats_monday.png` shows "7-DAY ACTIVITY" and "117.5H TOTAL" abutting the card edges. Code in `StatsScreen.tsx:200–210`:
  ```tsx
  <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-hairline dark:border-hairline-dark">
    <View className="flex-row items-center gap-2">
      <BarChart2 size={16} strokeWidth={1.25} color={iconColor} />
      <Text className="font-body-semibold text-xs text-ink dark:text-bone uppercase tracking-wider">
        7-Day Activity
      </Text>
    </View>
    <Text className="font-mono text-[10px] text-ink-muted dark:text-bone-muted uppercase">
      {formatHours(totalWeeklyMs)} TOTAL
    </Text>
  </View>
  ```
- Suspected Root Cause: Using raw `justify-between` without proportional horizontal padding (`px-1` or `px-2`), flex-shrink constraints, or max-width thresholds against the card's perimeter border.

---

### ISSUE-13 — Unresponsive Extremity Sticking on "Today's Usage Overview" Card Header in HomeScreen
- Category: UI
- Severity: Medium
- File(s): `src/screens/HomeScreen.tsx` (lines 198–205)
- Description: In `HomeScreen`, the primary donut chart card uses `<View className="w-full flex-row justify-between items-center mb-4">`. Just like in StatsScreen, "TODAY'S USAGE OVERVIEW" is pushed to the extreme left edge of the card, while the total usage metric ("7h 39m") is pushed to the extreme right edge. There is zero horizontal padding or responsive flex spacing, producing an uncomfortably rigid, edge-sticking visual layout across different screen sizes.
- Steps to Reproduce:
  1. Launch Blackout on device.
  2. Inspect the topmost card "Today's Usage Overview" on the Home dashboard.
  3. Notice "TODAY'S USAGE OVERVIEW" and "7h 39m" are jammed against the left and right card padding boundaries with no responsive margin.
- Evidence: Live capture `launch_screen.png`. Code in `HomeScreen.tsx:198–205`:
  ```tsx
  <View className="w-full flex-row justify-between items-center mb-4">
    <Text className="font-body-semibold text-[11px] text-ink-muted dark:text-bone-muted uppercase tracking-widest">
      Today's Usage Overview
    </Text>
    <Text className="font-mono-bold text-xs text-ink dark:text-bone">
      {formatMs(totalUsedTodayMs)}
    </Text>
  </View>
  ```
- Suspected Root Cause: Same pattern as Issue 12: `w-full flex-row justify-between` without internal margin insets, flex-shrink handling, or responsive container padding.

---

### ISSUE-14 — Floating Action Button (FAB) Overlays and Occludes Scrollable Content in HomeScreen
- Category: UI
- Severity: Medium
- File(s): `src/screens/HomeScreen.tsx` (lines 408–415)
- Description: The Add App floating action button (`+`) is anchored with absolute coordinates: `className="absolute bottom-20 right-6 w-14 h-14 ... z-40"`. Because the usage breakdown list inside the ScrollView extends into this coordinate space, the circular FAB physically floats over the right side of the bottom list item. On the physical device (1080x2460), the 8th row ("Calculator 4m (") is partially occluded and its right-hand content is unreadable and touch-blocked.
- Steps to Reproduce:
  1. Open Blackout with 8 or more apps active in today's usage breakdown.
  2. Observe the bottom of the card on the Home screen.
  3. Notice the floating button circles directly over the text of the last item in the breakdown list.
- Evidence: Real hardware capture `launch_screen.png` clearly shows the white/bone FAB circle directly covering "4m (" of the Calculator app row.
- Suspected Root Cause: The FAB is rendered as a floating overlay over an unpadded ScrollView without a dedicated floating action gutter or bottom spacer inside the card.

---

### ISSUE-15 — App Usage Breakdown Legend Rows Lack Responsive Truncation and Flex Constraints in HomeScreen
- Category: UI
- Severity: Low
- File(s): `src/screens/HomeScreen.tsx` (lines 280–298)
- Description: In the Home screen's usage breakdown legend, each row renders an app name on the left and a detailed metric string on the right: `{formatMs(seg.usedTodayMs)} ({percentOfTotal}%){seg.openCount ? " • " + seg.openCount + " opens" : ""}`. Because the right-hand text container has no `flex-shrink` restriction or responsive truncation on compact displays, long strings (e.g. `3h 16m (43%) • 224 opens`) crowd long app names, causing horizontal cramping and pushing text hard against the right edge of the card.
- Steps to Reproduce:
  1. Have an app with high opens (e.g., WhatsApp with 294 opens or Instagram with 224 opens).
  2. View the Home screen on a 360px device or with "Large Text" enabled in Android Accessibility Settings.
  3. Observe the row text pushing hard against the card border with no margin.
- Evidence: Visual capture `launch_screen.png` shows rows with long strings (`3h 16m (43%) • 224 opens`) running edge-to-edge.
- Suspected Root Cause: Right-hand metric text lacks `shrink` or breakpoint-aware formatting (e.g., dropping open counts on small screens or using responsive flex layout).

---

### ISSUE-16 — 7-Day Bar Chart Horizontal Cramping & Missing Dynamic Label Scaling in StatsScreen
- Category: UI
- Severity: Medium
- File(s): `src/screens/StatsScreen.tsx` (lines 212–260)
- Description: The 7-day bar chart packs seven columns into a single `flex-row justify-between items-end h-44 pt-2 px-1`. The numeric usage indicators above each bar (`formatHours(item.totalUsageMs)`) render values like `53.9h` and `117.5h`. On screens narrower than 375px (or when font scaling is increased in Android display settings), these 7 numeric labels touch, overlap, or run off the container edges due to the absence of min-width constraints, flexible spacing, or responsive abbreviation.
- Steps to Reproduce:
  1. Open Stats screen.
  2. Observe the 7 numeric labels above the vertical bars (`11.4h  12.7h  53.9h  15.1h  8.1h  8.6h  7.7h`).
  3. Notice how tightly packed they are horizontally with `px-1` padding.
  4. On narrow devices, numbers with 3+ characters touch each other without separation.
- Evidence: Live capture `screen_stats_monday.png` shows the 7 duration labels horizontally squeezed together across the 7 bars.
- Suspected Root Cause: Seven columns with fixed font sizes in a single unscrollable flex-row with insufficient padding and no dynamic font sizing.

---

### ISSUE-17 — Selected Day Summary Two-Column Divider Crowding on Historical Logs in StatsScreen
- Category: UI
- Severity: Low
- File(s): `src/screens/StatsScreen.tsx` (lines 176–196)
- Description: The summary card renders a two-column layout (`flex-row justify-around items-center`) with a centered hairline divider (`w-px h-10`). On past days, the left column header text is generated dynamically via `{getSelectedDayLabel()} TOTAL`, producing strings such as "MON, SEP 7 TOTAL". On compact devices, this wide header text expands horizontally and presses against the center divider and outer card boundaries without responsive text wrapping or font size clamping.
- Steps to Reproduce:
  1. In Stats screen, navigate to a past day like Monday Sep 7 or Wednesday Sep 9.
  2. Notice the left label reads "MON, SEP 7 TOTAL".
  3. On small screen viewports (360px), the text crowds the vertical hairline divider and outer padding.
- Evidence: `screen_stats_monday.png` displays "MON, SEP 7 TOTAL" spanning close to the center divider line.
- Suspected Root Cause: Dynamic multi-word uppercase date strings in a fixed two-column layout without `flex-1`, `text-center`, and `numberOfLines={1}` / `adjustsFontSizeToFit` controls.

---

### ISSUE-18 — Hardcoded Fixed-Pixel Margin Offsets (`ml-[28px]`, `ml-[46px]`) Causing Responsive Misalignment in Permissions and Add App Screens
- Category: UI
- Severity: Low
- File(s): `src/screens/PermissionsScreen.tsx` (line 143), `src/screens/AddAppScreen.tsx` (line 205)
- Description: Multiple sub-texts use hardcoded negative/positive margin pixel values to manually simulate indentation (e.g. `ml-[28px]` in PermissionsScreen descriptions, `ml-[46px]` in AddAppScreen usage sub-texts) instead of proper nested flexbox layout. When device font size or display scaling is toggled in Android OS, the text breaks alignment with the icon/title above it, either drifting inward or colliding with adjacent borders.
- Steps to Reproduce:
  1. Inspect `PermissionsScreen.tsx` line 143: `<Text className="... ml-[28px] ...">`.
  2. Inspect `AddAppScreen.tsx` line 205: `<Text className="... ml-[46px] ...">`.
  3. Change system font size to "Largest" in Android Settings and return to Blackout.
  4. Notice the description text is misaligned with the header text above it.
- Evidence: Static code inspection in `PermissionsScreen.tsx:143` and `AddAppScreen.tsx:205`.
- Suspected Root Cause: Using arbitrary pixel margins (`ml-[28px]`, `ml-[46px]`) rather than grouping icon and title in a flex container with consistent layout padding.

---

### ISSUE-19 — Active Locks & Maintenance Row Cards Rigid Extremity Clamping in SettingsScreen
- Category: UI
- Severity: Low
- File(s): `src/screens/SettingsScreen.tsx` (lines 190–215, 233–274)
- Description: Both the "Auto-Clean Uninstalled Apps" switch row and the "Active Today's Locks" list items utilize unconstrained `flex-row justify-between`. The status pill and duration (`RUNNING • 60M`) and the Android Switch toggle sit hard against the right edge of the card container, with insufficient proportional spacing between the left content and right control on narrow viewports.
- Steps to Reproduce:
  1. Open Settings screen.
  2. Scroll down to "MAINTENANCE" and "ACTIVE TODAY'S LOCKS".
  3. Inspect the right edge alignment of the switch and status text pills.
- Evidence: Captured in `screen_settings.png` and `screen_settings_scrolled.png`.
- Suspected Root Cause: Unbounded `justify-between` without internal card padding hierarchy or flex-shrink protection.
