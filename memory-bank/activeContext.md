# Active Context

## Current Status: Audit Round 4 — Comprehensive Fixes & Hardware Verification (Complete)
- **Mode**: Audit Round 4 Execution & Verification on Physical Hardware.
- **Tested Environment**: Physical hardware Infinix X6833B (Infinix NOTE 30), Android 14 (API 34), 1080x2460.
- **Target Issues Addressed**:
  1. Untrack / remove from lock list before limit is reached (`isLocked === false`).
  2. Overnight enforcement bypass / retroactive `lockExpirationTimestamp` backfill.
  3. Open count exact 2x overcounting fixed via 2000ms transition debouncing.
  4. Circular countdown badge overlaid on app icons on Home screen.
  5. Complete palette overhaul to unified "Navy Vintage" theme in both Light and Dark modes.
- **Build Verification**: `npx tsc --noEmit` (0 errors), offline embedded JS bundle (`expo export:embed`), `./gradlew assembleDebug --no-daemon` clean build, direct APK installation to `10275333B5001336`.

### Round 4 Hardware Verification Evidence:
1. **Phase 1 (Untrack / Remove Before Limit Reached)**:
   - Added `StorageService.removeTrackedApp(packageName)` with strict guard preventing removal if `isLocked === true`.
   - Added `AppContext.removeTrackedApp` with immediate native SharedPreferences synchronization (`syncLockedAppsToNative` and `syncLockedPackages`).
   - Added UI trash affordance (`Trash2`) on unlocked rows in `HomeScreen.tsx`.
   - Hardware verified: Untracked Calculator (`com.transsion.calculator`). Inspected `/data/data/com.blackout.app/shared_prefs/BlackoutPrefs.xml` via `adb shell run-as com.blackout.app cat` — confirmed Calculator was purged immediately from both JSON and locked package set. Actively locked app (`SIMOSA`) displayed no trash affordance and remained strictly immutable until midnight.
2. **Phase 2 (Overnight Enforcement Bypass / Retroactive Timestamp Backfill)**:
   - In `storage.ts` (`applyMidnightResetIfNeeded`), added backfill for any locked app missing `lockExpirationTimestamp` by computing local midnight following `lockDate` and persisting to both JS storage and native.
   - In `BlackoutAccessibilityService.kt` and `SecurityHelper.kt`, added native fallback parsing `lockDate` to compute expiration timestamp if `lockExpirationTimestamp <= 0L`.
3. **Phase 3 (Open Count Exactly 2x Overcounting Fixed)**:
   - Root Cause: On Android 14 (API 34), activity transition animations fire intermediate `ACTIVITY_PAUSED` events that set `currentPkg = null`. The subsequent `ACTIVITY_RESUMED` for the same app saw `currentPkg != pkg` and incremented the counter a second time.
   - Fix: Added 2000ms debouncing window in `BlackoutModule.kt` tracking `lastClosedPkg`, `lastClosedTime`, and `lastOpenTimeMap[pkg]`.
   - Hardware verified:
     - YouTube single deliberate open: count incremented from 1 -> 2 (+1 exact).
     - Chrome single deliberate open: count incremented from 3 -> 4 (+1 exact).
     - X single deliberate open: count incremented from 1 -> 2 (+1 exact).
     - Unopened apps remained identical.
4. **Phase 4 (Circular Countdown Badge on App Icons)**:
   - Built `CountdownBadge` component in `HomeScreen.tsx` positioned absolutely on top-left of app icons.
   - Displays whole minutes remaining (`remainingMs > 10000`) and transitions to second-by-second countdown in the final 10 seconds.
   - Hardware verified: Badge rendered cleanly on tracked app icon showing minutes remaining; transitions to stamp red in final urgency.
5. **Phase 5 (Navy Vintage Theme Palette Overhaul)**:
   - Fully replaced warm cream/rust palette with unified Navy Vintage family in both Light and Dark modes.
   - Light Tokens: Background `#E6E8EC` (pale slate-white), Surface `#EFF1F4`, Text `#1A2030` (navy ink), Muted `#5C6478`, Border `#C9CDD6`.
   - Dark Tokens: Background `#12161F` (near-black navy ink), Surface `#1B2030`, Text `#E6E8EC` (pale slate-white), Muted `#8C93A6`, Border `#2A3145`.
   - Shared Accents: Locked/Warning `#B23A2E` (stamp red), Safe/Unlocked `#4F7566` (aged-bronze verdigris).
   - Hardware verified: Captured screenshots across Home, Settings, and Stats in both Light and Dark modes. High-contrast typography and border fidelity confirmed.
