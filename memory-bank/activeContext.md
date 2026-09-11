# Active Context

## Current Status: Audit Round 2 - Phase 1 Completed

### Phase 1: Screen Time Accuracy (Completed & Verified)
1. **Root Cause Analysis & INTERVAL_BEST Findings**:
   - `UsageStatsManager.INTERVAL_BEST` resolves to `INTERVAL_DAILY` for sub-day time queries on Android.
   - Calling `queryUsageStats(INTERVAL_BEST, startTime, endTime)` returns multiple overlapping daily buckets.
   - Summing `stat.totalTimeInForeground` across all returned buckets accumulated multi-day usage: on-device test showed 10h 20m total (Instagram: 4h 34m) when Google Digital Wellbeing was actually 3h 21m (Instagram: 56m).
2. **Event-Based Engine Implementation**:
   - Implemented `getTodayUsageEventsMap` in `BlackoutModule.kt` and `getTodayPackageUsage` in `SecurityHelper.kt` utilizing `UsageEvents.queryEvents(startTime, endTime)`.
   - Walks raw system events chronologically, pairing `ACTIVITY_RESUMED` with subsequent `ACTIVITY_PAUSED` or new package `ACTIVITY_RESUMED` for true session durations.
   - Screen-off handling: handles `SCREEN_NON_INTERACTIVE` (16), `KEYGUARD_SHOWN` (17), and `DEVICE_SHUTDOWN` (26) by immediately terminating active session accumulation so device lock/screen-off time is never counted.
   - Ongoing sessions: caps live sessions cleanly at `endTime`.
   - Past days: for historical queries in `getDayUsageStats` (`dayOffset < 0`) and `getWeeklyUsageStats`, deduplicated `stat.totalTimeInForeground` using `maxOf` per package rather than sum.
   - Re-exported `android/app/src/main/assets/index.android.bundle` to resolve an unhandled `ReferenceError: Property 'systemColorScheme' doesn't exist` that previously caused app startup crashes.
3. **Physical Device Verification (Infinix X6833B, Android 14)**:
   - Google Digital Wellbeing: Total 3h 21m (includes non-launchable background apps), X: 1h 0m, Instagram: 56m, YouTube: 31m, WhatsApp: 14m.
   - Blackout Home Dashboard: Total 3h 1m (launchable user apps), X: 1h 0m (exact match), Instagram: 56m (exact match), YouTube: 29m (within 1-2m), WhatsApp: 14m (exact match).
   - Blackout Stats Screen: 3.0h today total, 3.0h today bar, individual app breakdowns match.
   - Zero over-counting detected.

---

## Next Phase
- **Phase 2 — Locked app shows warning overlay but keeps running behind it**:
  - Consolidate dual enforcement paths (`onAccessibilityEvent` TYPE_WINDOW_STATE_CHANGED vs 1-second `foregroundMonitorRunnable` polling loop) into a single authoritative enforcement handler in `BlackoutAccessibilityService.kt`.
  - Check return value of `performGlobalAction(GLOBAL_ACTION_HOME)`. If false, retry immediately with logging.
  - Coordinate overlay dismissal only when confirmed safe (e.g. verified foreground change away from blocked app).

## Manual Checks for Founder
- Open Blackout and observe the Home screen circular chart and top app breakdown.
- Compare X, Instagram, and WhatsApp minutes directly against the Google Digital Wellbeing app. They should match within 0-2 minutes.
- Check the Stats screen: the "TODAY" bar and today's total should match the Home screen.
