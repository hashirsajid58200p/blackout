# BLACKOUT — Comprehensive App Audit & Issues Report (Round 5)

**Date**: September 12, 2026  
**Target Device**: Physical Hardware Infinix X6833B (Infinix NOTE 30), Android 14 (API level 34), Resolution 1080x2460  
**Repository Branch**: `main` (clean working tree)  
**Audit Scope**: End-to-end code analysis and live hardware inspection covering:
1. Dialog & UI theming consistency (replacing un-themed native OS alerts with Navy Vintage modals).
2. Screen time calculation mechanics (`getTodayUsageEventsMap`, `UsageStatsManager`, multi-activity pause leaks, pre-installed system app filtering).
3. Lifecycle, navigation, state synchronization, and UI responsive layouts.

---

## Executive Summary

| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| **CRITICAL** | 2 | Intra-app activity transition usage wipeout; 18 un-themed native OS dialogs violating Navy Vintage design |
| **HIGH** | 3 | ROM system apps filtered out of stats; Rigid single-purpose `Modal.tsx`; Stale background session tracking in native service |
| **MEDIUM** | 6 | Midnight session boundary drop; Lockscreen unlock missing event; Double confirmation UX on removal; False "LOCKED TODAY" label in picker; Unhoisted function call; Unstyled root container |
| **LOW** | 4 | Inconsistent legacy olive color tokens; Clamping omission on today's usage; Unconditional cleanup in storage; Empty state CTA |
| **TOTAL** | **15** | **Fully analyzed with root causes and concrete resolution designs** |

---

## Catalog of Discovered Issues

### Table of Contents
1. [ISSUE-01 (CRITICAL) — Intra-App Activity Transitions Trigger Usage Wipeout in `getTodayUsageEventsMap`](#issue-01-critical--intra-app-activity-transitions-trigger-usage-wipeout-in-gettodayusageeventsmap)
2. [ISSUE-02 (CRITICAL) — 18 Occurrences of Native `Alert.alert` Bypass Navy Vintage Design System](#issue-02-critical--18-occurrences-of-native-alertalert-bypass-navy-vintage-design-system)
3. [ISSUE-03 (HIGH) — Pre-Installed ROM System Apps Discarded from Daily and Weekly Usage Stats](#issue-03-high--pre-installed-rom-system-apps-discarded-from-daily-and-weekly-usage-stats)
4. [ISSUE-04 (HIGH) — Rigid `Modal.tsx` Component Cannot Be Reused for General Dialogs](#issue-04-high--rigid-modaltsx-component-cannot-be-reused-for-general-dialogs)
5. [ISSUE-05 (HIGH) — Native Accessibility Service 10s Countdown Overlay Ignores Cumulative Usage](#issue-05-high--native-accessibility-service-10s-countdown-overlay-ignores-cumulative-usage)
6. [ISSUE-06 (MEDIUM) — Midnight Boundary Session Bleed Drops Pre-Midnight Usage Slices](#issue-06-medium--midnight-boundary-session-bleed-drops-pre-midnight-usage-slices)
7. [ISSUE-07 (MEDIUM) — Screen-Off / Keyguard Recovery Drops Subsequent Foreground Session](#issue-07-medium--screen-off--keyguard-recovery-drops-subsequent-foreground-session)
8. [ISSUE-08 (MEDIUM) — Double Confirmation Dialog Anti-Pattern on HomeScreen App Removal](#issue-08-medium--double-confirmation-dialog-anti-pattern-on-homescreen-app-removal)
9. [ISSUE-09 (MEDIUM) — Inaccurate "LOCKED TODAY" Badge on Unlocked Tracked Apps in `AddAppScreen`](#issue-09-medium--inaccurate-locked-today-badge-on-unlocked-tracked-apps-in-addappscreen)
10. [ISSUE-10 (MEDIUM) — Temporal Dead Zone Closure Risk for `formatMs` in `HomeScreen.tsx`](#issue-10-medium--temporal-dead-zone-closure-risk-for-formatms-in-homescreentsx)
11. [ISSUE-11 (MEDIUM) — Root Container in `App.tsx` References Deprecated `bg-background`](#issue-11-medium--root-container-in-apptsx-references-deprecated-bg-background)
12. [ISSUE-12 (LOW) — Hardcoded Legacy Olive Hex (`#6E7A54`) in `StatusPill.tsx`](#issue-12-low--hardcoded-legacy-olive-hex-6e7a54-in-statuspilltsx)
13. [ISSUE-13 (LOW) — Missing 24-Hour Clamp on Today's Cumulative Usage Sum in `BlackoutModule.kt`](#issue-13-low--missing-24-hour-clamp-on-todays-cumulative-usage-sum-in-blackoutmodulekt)
14. [ISSUE-14 (LOW) — `cleanUninstalledTrackedApps` Bypasses `autoCleanUninstalled` Setting](#issue-14-low--cleanuninstalledtrackedapps-bypasses-autocleanuninstalled-setting)
15. [ISSUE-15 (LOW) — Missing Zero-Tracked-Apps Call-to-Action Card on Home Screen](#issue-15-low--missing-zero-tracked-apps-call-to-action-card-on-home-screen)

---

### ISSUE-01 (CRITICAL) — Intra-App Activity Transitions Trigger Usage Wipeout in `getTodayUsageEventsMap`

- **Category**: Calculation Flaw / Core Tracking Bug
- **Severity**: Critical
- **Files Affected**:
  - `android/app/src/main/java/com/blackout/app/BlackoutModule.kt` (lines 251–280)
  - `android/app/src/main/java/com/blackout/app/SecurityHelper.kt` (lines 337–368)
- **Description**:  
  In Android, multi-activity applications (e.g., WhatsApp opening a chat conversation, Instagram viewing a reel or profile, Chrome switching to a new tab or settings, Gmail opening an email) perform an overlapping activity transition: the incoming activity fires `ACTIVITY_RESUMED` *before* the outgoing activity fires `ACTIVITY_PAUSED`.  
  In `BlackoutModule.kt` and `SecurityHelper.kt`, the event loop state machine treats any `ACTIVITY_PAUSED` event matching the package name as a signal that the user has left the app. It records the brief transition duration (~30–50ms) and immediately sets `currentPkg = null` and `currentStart = 0L`.  
  Because `currentPkg` is now `null`, the active session inside the newly resumed activity is completely untracked. All subsequent time spent by the user inside that activity is completely discarded until the user switches to another app.
- **Reproduction Steps**:
  1. Open WhatsApp or Instagram on the physical device.
  2. Navigate into a chat or view multiple profiles/reels for 5–10 minutes.
  3. Return to Blackout and observe the reported screen time.
  4. Compare the screen time against Android system `dumpsys usagestats` or Digital Wellbeing.
- **Physical Device Evidence**:
  - Direct hardware inspection on Infinix X6833B revealed:
    - Android OS internal usage bucket (`dumpsys usagestats`): WhatsApp accumulated **9m 36s** (`com.whatsapp totalTimeUsed="09:36"`).
    - Blackout Home screen reported: WhatsApp accumulated **3m** (over **68% missing screen time**).
    - Android OS internal usage bucket: Instagram accumulated **1h 17m 57s** (`com.instagram.android totalTimeUsed="1:17:57"`).
    - Blackout Home screen reported: Instagram accumulated **1h 10m** (**8 minutes of active reel/chat time lost**).
  - Relevant Event Log Sequence from `dumpsys usagestats`:
    ```text
    time="2026-09-12 00:05:48" type=ACTIVITY_RESUMED package=com.whatsapp class=com.whatsapp.Conversation
    time="2026-09-12 00:05:48" type=ACTIVITY_PAUSED package=com.whatsapp class=com.whatsapp.home.ui.HomeActivity
    ```
    `HomeActivity` was paused immediately *after* `Conversation` was resumed. In `BlackoutModule.kt:270`:
    ```kotlin
    UsageEvents.Event.ACTIVITY_PAUSED -> {
        if (currentPkg != null && currentPkg == pkg) {
            val duration = time - currentStart
            if (duration > 0) usageMap[pkg] = (usageMap[pkg] ?: 0L) + duration
            currentPkg = null  // <-- DESTROYS ACTIVE SESSION FOR Conversation!
            currentStart = 0L
        }
    }
    ```
- **Root Cause**:  
  The state machine assumed an application is represented by a single activity. It failed to track active activities by component/instance, or recognize that when `currentPkg == pkg`, an `ACTIVITY_PAUSED` for an older activity must not terminate tracking if another activity in the same package is currently resumed.
- **Proposed Fix**:  
  Maintain an active resumed activity reference or counter per package (using `event.className` or `event.instanceId` on API 29+). When `ACTIVITY_PAUSED` arrives for an activity that was already superseded by a newer resumed activity within the same package, do not set `currentPkg = null`. Only terminate the session when the active activity of that package pauses without a replacement, or when an activity from a different package resumes.

---

### ISSUE-02 (CRITICAL) — 18 Occurrences of Native `Alert.alert` Bypass Navy Vintage Design System

- **Category**: UI / Theme Mismatch (Founder-Reported)
- **Severity**: Critical
- **Files Affected**:
  - `src/screens/HomeScreen.tsx` (lines 83, 89, 100, 102, 109, 126, 132, 143)
  - `src/screens/SettingsScreen.tsx` (lines 46, 52, 63, 65, 72, 83, 85)
  - `src/screens/AddAppScreen.tsx` (lines 49, 54, 77)
- **Description**:  
  The user explicitly noted: *"when i remove an app the confirmation card that comes has not following the theme same as many other things one site as well"*.  
  There are 18 separate calls to React Native's native `Alert.alert()` across `HomeScreen`, `SettingsScreen`, and `AddAppScreen`. On Android, `Alert.alert()` invokes the Android OS native `AlertDialog.Builder`. This displays standard Android system popups with gray material backgrounds, system Roboto typography, and default OS button stylings.  
  This completely shatters the bespoke "Navy Vintage" visual identity (`#12161F` near-black espresso, `#EFF1F4` / `#1B2030` surfaces, `#2A3145` hairline borders, Fraunces serif headers, IBM Plex Mono metrics, and calibrated `#B23A2E` / `#4F7566` accents).
- **Reproduction Steps**:
  1. Tap the trash can icon next to an unlocked app on the Home screen.
  2. Notice the confirmation dialog: standard Android gray OS card with generic text and default teal/blue text buttons.
  3. Tap on a locked app: standard OS alert pops up.
  4. In `AddAppScreen`, tap "LOCK IT IN" with 0 minutes: standard OS alert pops up.
  5. In `SettingsScreen`, tap any active lock: standard OS alert pops up.
- **Physical Device Evidence**:
  - Verified on physical hardware via screenshots `blackout_delete_dialog.png` and `media_1789193324768.png`.
  - Contrast against `media_1789193508869.png` which shows the styled custom Modal:
    - Custom modal: Dark navy surface, crisp borders, Fraunces serif title, styled buttons.
    - Native `Alert.alert`: Generic Android system UI, zero brand consistency.
- **Root Cause**:  
  Rapid prototyping relied on React Native's built-in `Alert.alert()` convenience method for error handling, confirmations, and notices, rather than a centralized, themed Modal dialog system.
- **Proposed Fix**:  
  Create a global or hook-based custom Themed Dialog component (`AppDialog` or enhanced `Modal.tsx`) supporting:
  1. `confirm` variant (Title, Message, Confirm Button, Cancel Button).
  2. `danger` variant (Destructive actions like removing an app limit).
  3. `info` / `alert` variant (Single "ACKNOWLEDGE" or "DISMISS" button).
  Replace all 18 `Alert.alert` calls across `HomeScreen`, `SettingsScreen`, and `AddAppScreen` with this themed component.

---

### ISSUE-03 (HIGH) — Pre-Installed ROM System Apps Discarded from Daily and Weekly Usage Stats

- **Category**: Calculation Flaw / Inconsistency
- **Severity**: High
- **Files Affected**:
  - `android/app/src/main/java/com/blackout/app/BlackoutModule.kt` (lines 430–432, 462–464, 547–549)
- **Description**:  
  In `BlackoutModule.kt`, `getWeeklyUsageStats()` and `getDayUsageStats()` filter applications with:
  ```kotlin
  val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
                 (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
  if (isSystem) continue
  ```
  This unconditionally discards any launchable pre-installed application that has not received an update from Google Play (e.g. `com.transsion.calculator`, `com.transsion.camera`, `com.gallery20`, FM Radio, Sound Recorder).  
  While `getInstalledApps()` was updated to allow tracking these apps, `getDayUsageStats(0)` still discards them. Consequently:
  - If a user tracks Calculator, Calculator never appears in `todayDeviceUsage`.
  - `HomeScreen` falls back to `ta.usedTodayMs || 0`.
  - `todayTotalUsageMs` excludes Calculator, causing the donut chart segments and percentages to not sum up to the total screen time.
  - In `StatsScreen`, historical and daily breakdown views omit these apps entirely.
- **Reproduction Steps**:
  1. Add Calculator (`com.transsion.calculator`) to tracked apps with a 60m limit.
  2. Open and use Calculator for 2 minutes.
  3. Inspect Home screen: Total usage does not increment; Calculator's usage is missing from `todayDeviceUsage`.
- **Root Cause**:  
  The `FLAG_SYSTEM` filter was reintroduced to prevent background system services from polluting stats, but it used a blunt check on `FLAG_SYSTEM` rather than checking `pm.getLaunchIntentForPackage(pkg) != null` and filtering specific known daemons (`systemui`, `com.google.android.gms`, etc.).
- **Proposed Fix**:  
  Remove the blanket `isSystem` discard check. Allow any package that possesses a valid launcher intent (`pm.getLaunchIntentForPackage(pkg) != null`) to be included in usage stats, while retaining explicit exclusions for launchers, system UI, navigation bars, and the Blackout package itself.

---

### ISSUE-04 (HIGH) — Rigid `Modal.tsx` Component Cannot Be Reused for General Dialogs

- **Category**: UI Architecture / Component Design
- **Severity**: High
- **Files Affected**:
  - `src/components/ui/Modal.tsx` (lines 34–50)
- **Description**:  
  The current `<Modal>` component in `src/components/ui/Modal.tsx` contains hardcoded markup tailored solely to the "Lock Application" flow in `AddAppScreen.tsx`:
  ```tsx
  <View className="flex-row items-center gap-3">
    <AlertTriangle size={24} color="#B23A2E" strokeWidth={1.25} />
    <Text ...>{title}</Text>
  </View>
  <View className="bg-stamp-red/10 p-3 border border-stamp-red/30 rounded-sm">
    <Text className="text-xs font-mono-medium uppercase text-stamp-red text-center tracking-wider">
      This lock cannot be edited, paused, or undone today.
    </Text>
  </View>
  ```
  Because the red triangle icon, the warning callout box, and the default confirm label ("Confirm Lock") are hardcoded directly into the template, this component cannot be reused for removing an app, unlocking an app, or displaying standard informational errors.
- **Root Cause**:  
  Single-use component design created specifically for the timer setup step without parameterizing icons, callout banners, button variants, or dialog types.
- **Proposed Fix**:  
  Refactor `Modal.tsx` to support modular configuration:
  - `type?: "warning" | "danger" | "info" | "success"`
  - `icon?: React.ReactNode`
  - `calloutText?: string` (optional, rendered only when provided)
  - `confirmVariant?: "primary" | "danger" | "secondary"`
  - `singleButton?: boolean` (for alerts with only an "OK" / "DISMISS" button).

---

### ISSUE-05 (HIGH) — Native Accessibility Service 10s Countdown Overlay Ignores Cumulative Usage

- **Category**: Native Logic / Feature Bug
- **Severity**: High
- **Files Affected**:
  - `android/app/src/main/java/com/blackout/app/BlackoutAccessibilityService.kt` (lines 627–659)
- **Description**:  
  In `BlackoutAccessibilityService.kt`, `checkCountdownIfAboutToBlock(packageName)` calculates:
  ```kotlin
  val baseUsage = itemObj.optDouble("usedTodayMs", 0.0)
  val currentSessionTime = if (packageName == currentForegroundPackage && currentSessionStartTime > 0) {
      (System.currentTimeMillis() - currentSessionStartTime).toDouble()
  } else {
      0.0
  }
  val totalUsage = baseUsage + currentSessionTime
  ```
  1. `itemObj.optDouble("usedTodayMs", 0.0)` is only refreshed when the React Native frontend is actively running and syncs with native storage. When the user is using other apps, Blackout is backgrounded and the React Native thread is suspended, leaving `usedTodayMs` stale in SharedPreferences.
  2. `currentSessionTime` only measures the *current* continuous window state. If the user used an app for 3 minutes, exited to the launcher, and reopened the app, the previous 3 minutes are ignored by `checkCountdownIfAboutToBlock`!
  3. Consequently, the 10-second countdown warning overlay never appears if an app's limit was reached across multiple sessions.
- **Root Cause**:  
  `checkCountdownIfAboutToBlock` failed to query live cumulative usage via `SecurityHelper.getTodayPackageUsage(context, packageName)` (the way `isAppBlocked` does), relying instead on stale JSON fields and single-session timers.
- **Proposed Fix**:  
  In `checkCountdownIfAboutToBlock`, query `SecurityHelper.getTodayPackageUsage(this, packageName)` directly to determine the true cumulative usage since midnight, subtracting `initialUsageMs`, and show the countdown when `liveElapsed >= dailyLimitMs - 10000`.

---

### ISSUE-06 (MEDIUM) — Midnight Boundary Session Bleed Drops Pre-Midnight Usage Slices

- **Category**: Calculation Flaw / Edge Case
- **Severity**: Medium
- **Files Affected**:
  - `android/app/src/main/java/com/blackout/app/BlackoutModule.kt` (lines 225–244)
  - `android/app/src/main/java/com/blackout/app/SecurityHelper.kt` (lines 316–336)
- **Description**:  
  `queryEvents(startTime, endTime)` queries from `00:00:00` today to `System.currentTimeMillis()`.  
  If a user starts using an app before midnight (e.g. 11:50 PM) and continues past midnight (e.g. until 12:20 AM):
  - The `ACTIVITY_RESUMED` event occurred before `startTime` (yesterday).
  - The first event returned in today's query window is `ACTIVITY_PAUSED` at 12:20 AM.
  - Because `currentPkg` initializes to `null`, the `ACTIVITY_PAUSED` event is ignored.
  - The entire 20 minutes of usage belonging to today (12:00 AM to 12:20 AM) is completely lost!
- **Root Cause**:  
  The event query window starts strictly at midnight without looking back to identify which app was active across the midnight threshold.
- **Proposed Fix**:  
  Query events starting from `startTime - (12 * 3600 * 1000L)` to detect the active foreground activity immediately preceding midnight. If an app was resumed prior to midnight and paused after midnight, anchor `currentPkg = pkg` and `currentStart = startTime` (00:00:00).

---

### ISSUE-07 (MEDIUM) — Screen-Off / Keyguard Recovery Drops Subsequent Foreground Session

- **Category**: Calculation Flaw / OS Lifecycle Bug
- **Severity**: Medium
- **Files Affected**:
  - `android/app/src/main/java/com/blackout/app/BlackoutModule.kt` (lines 281–295)
  - `android/app/src/main/java/com/blackout/app/SecurityHelper.kt` (lines 355–367)
- **Description**:  
  When the device screen turns off or the lock screen appears, events `16` (`SCREEN_NON_INTERACTIVE`), `17` (`KEYGUARD_SHOWN`), or `26` (`DEVICE_SHUTDOWN`) fire.  
  The current code sets `currentPkg = null` and `currentStart = 0L`.  
  When the user turns the screen back on (`SCREEN_INTERACTIVE` = 15) and unlocks (`KEYGUARD_HIDDEN` = 18), Android frequently does NOT fire a new `ACTIVITY_RESUMED` event if the foreground activity was never paused or stopped by the system.  
  Because `currentPkg` remains `null`, all usage between unlocking and switching apps is lost.
- **Root Cause**:  
  The state machine handles screen-off by nullifying the package pointer, but fails to handle screen-on / unlock events to restore the active foreground package.
- **Proposed Fix**:  
  Track `suspendedPkg = currentPkg` upon `SCREEN_NON_INTERACTIVE` / `KEYGUARD_SHOWN`. Upon receiving `SCREEN_INTERACTIVE` (15) or `KEYGUARD_HIDDEN` (18), if no intermediate activity paused or changed, restore `currentPkg = suspendedPkg` and `currentStart = time`.

---

### ISSUE-08 (MEDIUM) — Double Confirmation Dialog Anti-Pattern on HomeScreen App Removal

- **Category**: UX / Flow Redundancy
- **Severity**: Medium
- **Files Affected**:
  - `src/screens/HomeScreen.tsx` (lines 108–149)
- **Description**:  
  When an app is tracked and unlocked, the card displays:
  `ALLOWANCE ACTIVE • X REMAINING`.
  Tapping this button calls `handleUnlockPress`, which shows a confirmation dialog:
  `"Allowance Active: Would you like to stop tracking and remove this limit? [Keep Active] [Remove Limit]"`.  
  If the user taps `[Remove Limit]`, `handleRemovePress` is invoked, which opens a SECOND confirmation dialog:
  `"Remove App Lock: Stop tracking and remove daily limit for X? [Cancel] [Remove]"`.  
  The user is forced to confirm the exact same action twice.
- **Root Cause**:  
  `handleUnlockPress` delegated to `handleRemovePress` without recognizing that `handleRemovePress` had its own built-in confirmation alert.
- **Proposed Fix**:  
  Unify the removal flow. The trash icon and the allowance button should invoke a single, cohesive Themed Modal asking: *"Stop tracking and remove daily limit for {appName}?"* with *"Cancel"* and *"Remove Limit"* actions.

---

### ISSUE-09 (MEDIUM) — Inaccurate "LOCKED TODAY" Badge on Unlocked Tracked Apps in `AddAppScreen`

- **Category**: UI / State Label Inaccuracy
- **Severity**: Medium
- **Files Affected**:
  - `src/screens/AddAppScreen.tsx` (lines 183–186)
- **Description**:  
  In `AddAppScreen.tsx`:
  ```tsx
  {isAlreadyTracked ? (
    <Text className="text-[10px] font-mono-bold uppercase text-stamp-red tracking-wider">
      LOCKED TODAY
    </Text>
  ) : ...}
  ```
  Any app currently in `trackedApps` is labeled `LOCKED TODAY` in bright red stamp text, even if `app.isLocked === false` (i.e. the app has an active allowance of 2 hours and has only used 5 minutes).  
  This is factually incorrect and misleads the user into believing the app is already blocked.
- **Root Cause**:  
  Conflation between "tracked / limit set for today" and "limit exceeded / actively locked".
- **Proposed Fix**:  
  Inspect `app.isLocked`. If `app.isLocked` is true, display `LOCKED TODAY` (`text-stamp-red`). If `app.isLocked` is false, display `ACTIVE LIMIT` (`text-stamp-olive`) or `TRACKED TODAY`.

---

### ISSUE-10 (MEDIUM) — Temporal Dead Zone Closure Risk for `formatMs` in `HomeScreen.tsx`

- **Category**: Code Quality / Runtime Safety
- **Severity**: Medium
- **Files Affected**:
  - `src/screens/HomeScreen.tsx` (line 111 vs line 170)
- **Description**:  
  In `HomeScreen.tsx`, line 111 calls `formatMs(app.dailyLimitMs)` inside `handleUnlockPress`.  
  However, `const formatMs = (ms: number) => { ... }` is defined at line 170 as an unhoisted arrow function.  
  While current execution happens inside a click handler, any refactor, unit test, or component initialization that touches `handleUnlockPress` earlier will crash with `ReferenceError: Cannot access 'formatMs' before initialization`.
- **Root Cause**:  
  Helper utility defined as a local arrow function mid-component rather than a hoisted function declaration or external utility in `src/utils/formatters.ts`.
- **Proposed Fix**:  
  Extract `formatMs` and `formatHours` to a shared utility file `src/utils/time.ts` or declare them as hoisted functions outside the React component.

---

### ISSUE-11 (MEDIUM) — Root Container in `App.tsx` References Deprecated `bg-background`

- **Category**: UI / Theming
- **Severity**: Medium
- **Files Affected**:
  - `App.tsx` (line 73)
- **Description**:  
  In `App.tsx:73`:
  ```tsx
  <View className="flex-1 bg-background dark:bg-espresso">
  ```
  In `tailwind.config.js`, the official Navy Vintage light background token is `paper` (`#E6E8EC`). While `background` is aliased in `extend.colors`, all other screen containers explicitly use `bg-paper dark:bg-espresso`. During navigation transitions or notch insets, this minor inconsistency can cause token mismatch.
- **Root Cause**:  
  Incomplete token migration in root `App.tsx` during the Navy Vintage palette overhaul.
- **Proposed Fix**:  
  Change `bg-background dark:bg-espresso` to `bg-paper dark:bg-espresso`.

---

### ISSUE-12 (LOW) — Hardcoded Legacy Olive Hex (`#6E7A54`) in `StatusPill.tsx`

- **Category**: Theme Inconsistency
- **Severity**: Low
- **Files Affected**:
  - `src/components/ui/StatusPill.tsx` (line 27)
- **Description**:  
  In `StatusPill.tsx:27`:
  ```tsx
  <Check size={11} color="#6E7A54" strokeWidth={1.25} />
  ```
  `#6E7A54` is the old army-olive accent from Audit Round 3. In Audit Round 4, the palette was unified to `#4F7566` (aged-bronze verdigris). Line 27 was missed and still renders the old color.
- **Root Cause**:  
  Hardcoded color string overlooked during the global palette sweep.
- **Proposed Fix**:  
  Update `color="#6E7A54"` to `color="#4F7566"`.

---

### ISSUE-13 (LOW) — Missing 24-Hour Clamp on Today's Cumulative Usage Sum in `BlackoutModule.kt`

- **Category**: Calculation Flaw / Edge Case
- **Severity**: Low
- **Files Affected**:
  - `android/app/src/main/java/com/blackout/app/BlackoutModule.kt` (lines 433–437)
- **Description**:  
  For past days (`i < 6`), `getWeeklyUsageStats()` strictly clamps `dayTotalMs = Math.min(dayTotalMs, 24L * 3600 * 1000)`.  
  However, for today (`i == 6`), `dayTotalMs` is summed without an upper bound clamp (`endTime - dayStart` or 24h). In the unlikely event of concurrent foreground event anomalies, today's total could exceed physical day bounds.
- **Root Cause**:  
  Asymmetry in defensive clamping between past days and the current day branch.
- **Proposed Fix**:  
  Apply `dayTotalMs = Math.min(dayTotalMs, System.currentTimeMillis() - dayStart)` on the `i == 6` branch.

---

### ISSUE-14 (LOW) — `cleanUninstalledTrackedApps` Bypasses `autoCleanUninstalled` Setting

- **Category**: Logic Inconsistency
- **Severity**: Low
- **Files Affected**:
  - `src/services/storage.ts` (lines 138–150)
- **Description**:  
  `StorageService.cleanUninstalledTrackedApps` purges tracked apps if they are missing from installed packages without checking whether `settings.autoCleanUninstalled` is enabled. If invoked directly, it would bypass user preferences.
- **Root Cause**:  
  The guard was placed in `AppContext.tsx` rather than inside the service method itself.
- **Proposed Fix**:  
  Read `settings` inside `cleanUninstalledTrackedApps` and return early if `autoCleanUninstalled === false`.

---

### ISSUE-15 (LOW) — Missing Zero-Tracked-Apps Call-to-Action Card on Home Screen

- **Category**: UI / UX
- **Severity**: Low
- **Files Affected**:
  - `src/screens/HomeScreen.tsx` (lines 420–425)
- **Description**:  
  When `trackedApps.length === 0`, the Home screen renders an empty gap below the usage overview with no visual feedback other than the bottom floating `+` button. Users on a fresh installation have no guidance on how to begin tracking apps.
- **Root Cause**:  
  Absence of an empty state card for the tracked apps section.
- **Proposed Fix**:  
  Render a dashed-border hairline Card when `trackedApps.length === 0` reading: *"NO APPLICATIONS TRACKED • TAP + TO CONFIGURE IMMUTABLE LIMIT"*.

---

## Architectural Strategy for Next Resolution Chat

When the user launches the next chat with an implementation plan, the following architectural approach is recommended:

1. **Phase 1: Centralized Themed Modal / Dialog System**:
   - Refactor `src/components/ui/Modal.tsx` into a reusable, versatile dialog component supporting confirmation, destructive action, warning, and informational states.
   - Replace all 18 occurrences of native `Alert.alert()` in `HomeScreen.tsx`, `SettingsScreen.tsx`, and `AddAppScreen.tsx`.
   - Eliminate the double-confirmation UX when removing tracked apps.

2. **Phase 2: Event-Accurate Screen Time Tracking Engine**:
   - Rewrite `getTodayUsageEventsMap()` in `BlackoutModule.kt` and `SecurityHelper.getTodayPackageUsage()` to track activity components properly so intra-app activity transitions do not nullify the active session.
   - Remove the blanket `isSystem` discard filter to restore accurate tracking for ROM system applications (Calculator, Camera, Gallery).
   - Implement midnight lookback and keyguard unlock state recovery.

3. **Phase 3: Synchronized Live Limit Enforcement in Accessibility Service**:
   - Upgrade `checkCountdownIfAboutToBlock()` in `BlackoutAccessibilityService.kt` to query live cumulative usage across all sessions today, ensuring the 10-second warning banner triggers accurately.

4. **Phase 4: Visual & Theme Polish**:
   - Update `StatusPill.tsx` to `#4F7566`.
   - Update `App.tsx` root container to `bg-paper dark:bg-espresso`.
   - Fix "LOCKED TODAY" status in `AddAppScreen.tsx` for unlocked apps.
   - Extract `formatMs` / `formatHours` into a hoisted utility.
