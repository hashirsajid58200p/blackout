# Active Context

## Current Status: Audit Round 5 — Comprehensive Deep-Dive Analysis & Bug Catalog (Complete)
- **Mode**: Exhaustive codebase and physical hardware QA audit.
- **Tested Hardware**: Physical Infinix NOTE 30 (X6833B), Android 14 (API 34), 1080x2460.
- **Completed Objectives**:
  1. Complete code and hardware investigation into dialog theming inconsistencies (`Alert.alert` bypassing Navy Vintage).
  2. Complete root cause discovery of screen time calculation discrepancies between Blackout and Android OS.
  3. Cataloged 15 distinct issues (2 Critical, 3 High, 6 Medium, 4 Low) with hardware evidence, repro steps, root causes, and architectural solutions in `ISSUES_REPORT.md`.
  4. Prepared comprehensive documentation for the user's upcoming fix & implementation chat.

### Round 5 Key Discoveries:
1. **Screen Time Discrepancy Root Cause (ISSUE-01)**:
   - In `BlackoutModule.kt:getTodayUsageEventsMap` and `SecurityHelper.kt:getTodayPackageUsage`, receiving `ACTIVITY_PAUSED` immediately sets `currentPkg = null`. In multi-activity apps (e.g. WhatsApp, Instagram), Android resumes the incoming activity *before* pausing the outgoing activity (~50ms later). The delayed pause of the previous activity triggers `currentPkg = null`, causing the entire active session in the new activity to be untracked. On hardware: WhatsApp OS usage was 9m 36s vs Blackout's 3m (68% underreported); Instagram OS usage was 1h 18m vs Blackout's 1h 10m.
2. **Pre-Installed App Discard Filter (ISSUE-03)**:
   - `getWeeklyUsageStats()` and `getDayUsageStats()` filter apps with `(flags and FLAG_SYSTEM) != 0 && (flags and FLAG_UPDATED_SYSTEM_APP) == 0`, dropping launchable pre-installed apps without Play Store updates (like Calculator).
3. **Themed Dialog Inconsistency (ISSUE-02 & ISSUE-04)**:
   - 18 separate calls to native `Alert.alert()` across `HomeScreen.tsx`, `SettingsScreen.tsx`, and `AddAppScreen.tsx` display generic Android system gray popups that ignore the Navy Vintage design system.
   - `Modal.tsx` is hardcoded with "Confirm Lock" and red warning text, preventing reuse for general app confirmations and notices.
4. **Native Countdown Multi-Session Disconnect (ISSUE-05)**:
   - `checkCountdownIfAboutToBlock` in `BlackoutAccessibilityService.kt` relies on stale SharedPreferences and measures only the current single continuous session, failing to trigger the 10-second warning if an app was used across multiple sessions.

