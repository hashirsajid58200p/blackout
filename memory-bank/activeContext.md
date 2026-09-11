# Active Context

## Current Status: Persistent App Fixes (Issues 1, 2, 3) — COMPLETED & VERIFIED ON DEVICE

### Persistent Issues Resolution Overview
1. **Issue 1 (Locked App Premature Unlock Blocked)**:
   - Enforced strict lock retention in native `SecurityHelper.unlockPackage` and TypeScript `StorageService.unlockTrackedApp`. Unlocking is prohibited and rejected across all UI paths, navigation, restarts, or state manipulations while `now < lockExpirationTimestamp` (midnight).
   - In `HomeScreen` and `SettingsScreen`, locked apps display `"LOCKED UNTIL MIDNIGHT"`. Tapping while locked displays an alert informing the user that premature unlock is prohibited. Once the lock period has completed, the action becomes available to unlock the app.
2. **Issue 2 (Screen-Time Calculation & Timing Drift Resolved)**:
   - Root cause identified: In `BlackoutModule.kt`, `(appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 && (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0` was discarding launchable pre-installed system apps (Phone, Chrome, Calculator, Deskclock, Settings).
   - Removing this filter restored missing usage (~16 minutes), bringing Blackout's screen-time calculation in exact parity with Android Digital Wellbeing without hardcoded offsets.
3. **Issue 3 (Delayed Lock Until Configured Timer Completes)**:
   - Root cause identified: `StorageService.addTrackedApp` and `AppContext.tsx` were comparing total daily usage since midnight against the timer limit (`dailyLimitMs`), causing apps already used earlier today (e.g. WhatsApp with 21m) to lock immediately on 5m timer creation.
   - Introduced `initialUsageMs` as the baseline at timer configuration. Tracking calculates `elapsed = Math.max(0, currentDeviceUsage - initialUsageMs)`. Newly added apps stay in `MONITORED / TIMER RUNNING` state ("ACTIVE") and only lock when elapsed usage >= configured limit. Verified live with Calculator and Spotify on physical hardware.

---

### Completed Phases Summary

#### Phase 0 — Design Tokens & Font Loading
- Installed `@expo-google-fonts/fraunces`, `@expo-google-fonts/inter`, `@expo-google-fonts/ibm-plex-mono`.
- Gated splash screen in `App.tsx` until fonts are loaded via `useFonts` + `SplashScreen.preventAutoHideAsync()`.
- Added font family definitions to `tailwind.config.js`: `display` (Fraunces), `body` (Inter), `mono` (IBM Plex Mono).
- Registered named color tokens: `paper`, `paper-surface`, `ink`, `ink-muted`, `hairline`, `espresso`, `espresso-surface`, `bone`, `bone-muted`, `hairline-dark`, `stamp-red`, `stamp-olive`.
- Set default 1px hairline border width and 2-4px radius scale.

#### Phase 1 — Shared Components
- `Card.tsx`: 1px hairline borders (`border-hairline dark:border-hairline-dark`), rounded corners, paper/espresso surfaces.
- `BottomNavBar.tsx`: 1.25 stroke thin line icons, active-tab indication via ink color + label (removed filled highlight block), hairline top border.
- `NavigationHeader.tsx`: Fraunces serif display title, 1.25 stroke chevron back button in hairline box, hairline bottom border.
- `Button.tsx`: Rounded 2-4px corners, 1px border, ink primary / hairline secondary / stamp-red danger.
- `ProgressBar.tsx`: 2px hairline height, stamp-red locked / ink normal.
- `StatusPill.tsx`: Rubber-stamp border badge with monospace typography (`font-mono-bold text-[10px]`).
- `Modal.tsx`: Hairline paper/espresso dialog with Fraunces title and stamp-red warning callout.

#### Phase 2 — Onboarding & Permissions Screens
- `OnboardingScreen.tsx`: Fraunces serif headlines, dash step indicators (32px active pill, 16px inactive pill, replacing continuous bar), hairline icon box with 1.25 stroke icons.
- `PermissionsScreen.tsx`: Fraunces headline, hairline cards, sage-olive "GRANTED" rubber-stamp badge, subtle hairline "GRANT" button, muted offline privacy note.

#### Phase 3 — Home / Dashboard Screen
- `HomeScreen.tsx`: "Focus" Fraunces hero, IBM Plex Mono numerals for total time, warm palette SVG donut chart (`#FBF8F1`/`#241F19` canvas with proportional paper/bone arcs), ledger breakdown list with hairline borders, locked app cards with rubber-stamp badges, and dark ink FAB.

#### Phase 4 — Add App Screen
- `AddAppScreen.tsx`: Hairline search input, ledger app list row styling, IBM Plex Mono hours/minutes stepper controls, "LOCK IT IN" CTA button. Preserved `NativeBridge.getInstalledApps` and limit-setting logic intact.

#### Phase 5 — Stats Screen
- `StatsScreen.tsx`: Flat hairline-bordered 7-day bars in new palette, over/under limit accent coloring on selected day (stamp-red if above weekly average, sage-olive if within limits), IBM Plex Mono numerals, Fraunces titles, and day-navigation carousel.

#### Phase 6 — Settings Screen
- `SettingsScreen.tsx`: Restyled theme selector (System / Light / Dark) with hairline containers, Device Admin card, maintenance auto-clean toggle (`updateAutoCleanSetting`), and locked apps viewer in paper/espresso hairline cards.

#### Phase 7 — Locked / Blackout Screen(s) & Native Overlay
- `BlackoutScreen.tsx`: In-app React screen updated with espresso background, Fraunces serif title ("{appName} is dark."), rubber-stamp locked badge tilted -3°, and bone action button.
- `BlackoutAccessibilityService.kt`: Ported the Vintage Minimalist design to the native Android overlay (`initOverlayView`): espresso `#1B1712` background, bone `#EDE4D3` serif typography, stamp-red `#B23A2E` rubber-stamp locked badge, bone-muted `#A89A85` copy, and rounded 4px bone action button. Preserved all native blocking, window handling, and touch consumption logic.

#### Phase 8 — Full Consistency Pass & Regression Check
- All `border-2` replaced with 1px hairline borders (`border`).
- All raw hex codes match the Vintage Minimalist palette.
- All icon stroke widths standardized to 1.25 (1.5 on FAB).
- IBM Plex Mono used consistently across all numbers, timers, limits, and dates.
- Verified TypeScript compilation: `npx tsc --noEmit` (0 errors).
- Verified Android bundle export: `npx expo export:embed` (2370 modules bundled cleanly).
- Verified Kotlin debug compilation: `./gradlew :app:compileDebugKotlin` (BUILD SUCCESSFUL).

---

### What to Visually Check on Device
1. **Home Screen**: Warm paper/espresso background, Fraunces hero headline, IBM Plex Mono screen time timer, warm donut chart, ledger app list.
2. **Stats Screen**: Flat hairline 7-day bars with over/under-average accent colors, IBM Plex Mono daily totals.
3. **Add App Screen**: Hairline search input, app list items, monospace hour/minute stepper, "LOCK IT IN" button.
4. **Settings Screen**: Hairline theme selector cards, Device Admin activation card, auto-clean toggle switch.
5. **Locked State**: Launch a locked app or trigger blackout screen to verify the espresso background with the tilted rubber-stamp badge.
