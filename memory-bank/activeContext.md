# Active Context

## Current Status: Audit Round 3 — COMPLETED & VERIFIED ON PHYSICAL HARDWARE (Infinix X6833B)

### Audit Round 3 Summary of Resolved Issues

1. **Phase 1 — Live Time Lock Expiration & Self-Healing (Fixed & Verified)**:
   - **Root Cause**: `SecurityHelper.markPackageLocked()` recorded `lockExpirationTimestamp`, but neither `BlackoutAccessibilityService.isAppBlocked()` nor `SecurityHelper.hasActiveLocks()` read this field. The system depended entirely on external midnight alarms or JS app reopen. Furthermore, `AppContext.tsx` had a one-way ratchet (`isLocked: app.isLocked || isNowLocked`).
   - **Fix Implemented**:
     - In `BlackoutAccessibilityService.kt` (`isAppBlocked`), read `lockExpirationTimestamp` from JSON. If `now >= lockExpirationTimestamp` (and > 0), the app is treated as immediately unlocked, removed from `lockedPackages`, and allowed normal access without waiting for alarms or app reopen. Removed blind `lockedPackages.contains()` bypass.
     - In `SecurityHelper.kt`, updated `saveLockedApps`, `hasActiveLocks`, and `unlockPackage` to check `lockExpirationTimestamp > 0 && now >= lockExpirationTimestamp`.
     - In `StorageService.applyMidnightResetIfNeeded`, checks `(app.lockExpirationTimestamp && now >= app.lockExpirationTimestamp)` in addition to date changes.
     - In `AppContext.tsx` (`fetchUsage`), broke the one-way ratchet: computes `isExpired = Boolean(app.lockExpirationTimestamp && now >= app.lockExpirationTimestamp)` and `finalLocked = (!isExpired && app.isLocked) || isNowLocked`.
     - **Critical OEM Bug Fixed**: In `isLauncherOrHome(packageName)`, removed `lower.contains("transsion")` which was causing Transsion pre-installed apps (like `com.transsion.calculator`) to be mistaken for the home launcher.
   - **Verification on Device**:
     - Tested locked app (`Calculator`) within lock period: intercepted within 2ms, bounced to home, full overlay shown.
     - Tested expired locked app past its timestamp: opened immediately and cleanly without opening Blackout first (`Lock expired for com.transsion.calculator ... Allowing access`).
     - Tested within-limit app: does not lock prematurely.

2. **Phase 2 — Screen-Time Total System App Regression (Fixed & Verified)**:
   - **Root Cause**: Commit `498b66b` removed the `FLAG_SYSTEM` filter across `BlackoutModule.kt`, unintentionally re-introducing system apps (Settings, Phone, etc.) into `getDayUsageStats()` and `getWeeklyUsageStats()`.
   - **Fix Implemented**:
     - Restored `(appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 && (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0` filter strictly in `getDayUsageStats()` and `getWeeklyUsageStats()` (both today and past days).
     - Kept `getInstalledApps()` unfiltered by system flag so users can still choose to track and limit launchable system apps.
   - **Verification on Device**:
     - Total usage matches user foreground apps: 4h 47m (Instagram 2h 28m, X 1h 0m, YouTube 29m, WhatsApp 21m, ChatGPT 6m, Chrome 5m, easypaisa 4m, Gmail 4m). Pure system apps are completely excluded from the totals.

3. **Phase 3 — Theme Visual Audit & System Mode Sync (Verified & Documented)**:
   - **Visual Sweep**: Audited all 4 primary screens (Home, Stats, Settings, Add App) via screencaps in Light, Dark, and System modes on `Infinix_X6833B`. All cards, hairline borders, muted texts, and badges show excellent contrast.
   - **System -> Light -> System Transition**: Verified switching from System to Light to System updates immediately on device without reopen.
   - **Live OS Night Mode Toggle**: Tested `cmd uimode night no` and `cmd uimode night yes` live on device; app immediately transitions between Light (warm paper) and Dark (espresso).
   - **Native Lock Overlay Theme Decision**:
     - The native lock overlay (`BlackoutAccessibilityService.initOverlayView()`) is intentionally fixed to the dark/espresso palette (`#1B1712` background, `#EDE4D3` bone serif text, `#B23A2E` rubber-stamp locked badge) in accordance with the Vintage Minimalist design brief ("this screen can intentionally use the same dark treatment in both modes" representing "Blackout" / darkness). Recorded here explicitly to prevent future re-litigation.

4. **Phase 4 — Open-Ended Audit & UI Affordances**:
   - `unlockTrackedApp` / `unlockPackage` is fully wired into `HomeScreen.tsx` and `SettingsScreen.tsx`:
     - While locked: button reads "LOCKED UNTIL MIDNIGHT" and alerts user that premature unlock is prohibited.
     - When expiration passes: button reads "UNLOCK APPLICATION" and displays a confirmation dialog to restore normal access.
   - Added `style={{ elevation: 8 }}` to the FAB button on `HomeScreen.tsx` to ensure touch responder priority on Android.

---

### What to Specifically Check on Device (Founder Testing Guide)
1. **Screen Time Accuracy**:
   - Open Home screen and Stats screen. Compare total (e.g. 4h 47m) against Android Digital Wellbeing. Verify only real user apps appear in breakdown.
2. **Locking & Unlock Expiration**:
   - Add an app with a daily limit or let it lock. Verify it immediately bounces to Home when opened.
   - Wait until midnight (or adjust clock): verify the app opens normally without having to open Blackout first.
3. **Theme & System Mode**:
   - In Settings, switch between System, Light, and Dark.
   - Toggle device Dark Theme in Android Quick Settings: verify Blackout updates dynamically.
