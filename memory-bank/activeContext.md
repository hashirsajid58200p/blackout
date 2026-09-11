# Active Context

## Current Status: Audit Round 2 - Phase 0 Completed

### Phase 0: Reconcile Native Android Code Copies (Completed & Committed)
1. **Source of Truth Decision**:
   - `android/app/src/main/java/com/blackout/app/` is officially the **single source of truth** for all native Android code.
   - All 15+ rounds of bug fixes and real device optimizations reside in the checked-in `android/` directory.
2. **Plugin Refactoring**:
   - In `plugins/withBlackoutNativeModule.js`, deleted all embedded stale Kotlin template strings (438 lines removed).
   - Removed generation logic that previously wrote `BlackoutDeviceAdminReceiver.kt`, `BlackoutAccessibilityService.kt`, `BlackoutModule.kt`, and `BlackoutPackage.kt`.
   - The config plugin now cleanly and exclusively manages AndroidManifest permissions/queries/services/receivers, XML resource files (`accessibility_service_config.xml`, `device_admin.xml`), and `MainApplication.kt` package registration.
3. **Prebuild Dev Loop Verification**:
   - Confirmed neither `app.json` nor `package.json` contains `expo prebuild --clean`.
   - Developers and CI should not run `expo prebuild --clean` without being aware that native changes are maintained in `android/`.
4. **Verification**:
   - TypeScript compilation: `npm run tsc` passed with 0 errors.
   - Kotlin compilation: `./gradlew :app:compileDebugKotlin` passed with `BUILD SUCCESSFUL in 22s`.
   - Changes committed to git: `refactor(native): eliminate duplicate embedded native templates from config plugin (Phase 0)`.

---

## Next Phase
- **Phase 1 — Screen time is still off (app: 8h29m vs. Android Digital Wellbeing: 8h19m)**:
  - Replace `UsageStatsManager.INTERVAL_DAILY` with `UsageStatsManager.INTERVAL_BEST` across all call sites in `BlackoutModule.kt` (`getTodayUsage`, `getWeeklyUsageStats`, `getDayUsageStats`) and `SecurityHelper.kt` (`getPackageUsageLimit`).
  - Cross-check against `adb shell dumpsys usagestats`.
  - If discrepancy remains after testing, fall back to event-based `UsageEvents.queryEvents` with `SCREEN_INTERACTIVE` / `SCREEN_NON_INTERACTIVE` boundary handling for today's live stats.

## Manual Checks for Founder
- No manual phone action required for Phase 0 (code deduplication only). The app builds cleanly and native files in `android/` are fully preserved.
