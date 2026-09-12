# Active Context

## Current Status: DESIGN.md Redesign — "Vintage Minimalist / Ledger Instrument" (Phases 0–8 Complete)
- **Mode**: Complete presentation-layer redesign applying `design_reference/DESIGN.md` across the entire application without touching any underlying enforcement, tracking, permission, or native logic.
- **Verification Status**:
  - `npx tsc --noEmit`: Clean (0 errors).
  - Expo Offline Bundle (`createBundleDebugJsAndAssets`): Clean (2,354 modules).
  - Android Gradle Build (`./gradlew assembleDebug`): Clean (`BUILD SUCCESSFUL in 52s`).

## Phase Breakdown & Accomplishments:

### Phase 0 — Design Tokens & Custom Typography Engine
- Installed and wired official Google Fonts via `@expo-google-fonts/*`:
  - Display & Headlines: `LibreCaslonText_400Regular`, `LibreCaslonText_700Bold`.
  - Body & UI Controls: `PublicSans_400Regular`, `PublicSans_500Medium`, `PublicSans_600SemiBold`, `PublicSans_700Bold`.
  - Chronometer & Numerals: `IBMPlexMono_400Regular`, `IBMPlexMono_500Medium`, `IBMPlexMono_600SemiBold`, `IBMPlexMono_700Bold`.
- Loaded in `App.tsx` via `useFonts()` gated behind `SplashScreen.preventAutoHideAsync()` and `SplashScreen.hideAsync()`.
- Updated `tailwind.config.js`:
  - Configured font families: `font-display`, `font-body`, `font-mono` with weight variants.
  - Configured palette tokens: `paper` (`#E6E8EC`), `paper-surface` (`#EFF1F4`), `ink` (`#1A2030`), `ink-muted` (`#5C6478`), `hairline` (`#C9CDD6`), `espresso` (`#12161F`), `espresso-surface` (`#1B2030`), `bone` (`#E6E8EC`), `bone-muted` (`#8C93A6`), `hairline-dark` (`#2A3145`), `stamp-red` (`#B23A2E`), `brass` (`#A67C3D`), and `stamp-brass` (`#A67C3D`).
  - Strict angular rigidity: `borderRadius` defaults to `2px`, `none` is `0px`, no pills or soft bubbles.
  - Hairline borders: `1px` default.
  - Zero shadows: `boxShadow` explicitly set to `none`.

### Phase 1 — Shared Components Overhaul
- `Card.tsx`: Hairline border (`1px`), `rounded-none`, dual surface grounds (`paper-surface` / `espresso-surface`), `stamp-red/60` border for locked variant.
- `BottomNavBar.tsx`: 1.25px line icons, uppercase Public Sans bold typography (`tracking-[0.12em]`), hairline top border.
- `NavigationHeader.tsx`: Uppercase tracked Libre Caslon title (`tracking-[0.06em]`), hairline back button (`rounded-none`), hairline bottom divider.
- `Button.tsx`: Rectilinear buttons (`rounded-none`, `border-1`), uppercase tracked Public Sans (`tracking-[0.1em]`), inverted dark/light primary states, transparent hairline secondary, and stamp-red emergency action.
- `Modal.tsx`: Rectilinear modal plate, hairline borders, uppercase tracked headers, brass success icon (`#A67C3D`), stamp-red warnings.
- `ProgressBar.tsx`: 1.5px slim height, `rounded-none`, hairline border, brass active fill (`#A67C3D`) and stamp-red locked fill (`#B23A2E`).
- `StatusPill.tsx`: Replaced pill contours with rectilinear stamp tags (`rounded-none`), brass active state (`#A67C3D`) and stamp-red locked state (`#B23A2E`) with monospace tracking.

### Phase 2 — Onboarding & Permissions Screens
- `OnboardingScreen.tsx`: Rectilinear icon container, uppercase tracked subtitle (`tracking-[0.12em]`), Libre Caslon display titles, and rectilinear step indicator tabs (no rounded pills).
- `PermissionsScreen.tsx`: Rectilinear cards, brass checkmarks and granted tags (`#A67C3D`), hairline action buttons, zero logic modifications.

### Phase 3 — Home / Dashboard Screen
- Date Header: "Focus" in Libre Caslon Text with uppercase IBM Plex Mono date.
- Multi-Segment Circular Usage Chart: Calibrated vintage palette (`#E6E8EC`, `#C9CDD6`, `#8C93A6`, `#5C6478`, `#4F7566`, `#3A4359`, `#2A3145`), center readout in IBM Plex Mono display numerals.
- Breakdown Legend: Rectilinear color swatches, monospace usage statistics, tap-to-highlight interaction preserved.
- Empty State: Rectilinear card with Plus icon, navigating to `add_app`.
- Tracked Applications: Rectilinear cards, 9x9 square app icon containers, uppercase bold titles, rectilinear countdown badge (18x18 square with monospace digits), brass allowance buttons, and stamp-red locked alerts.
- FAB: Rectilinear (`rounded-none`), zero elevation (`elevation: 0`, `shadow-none`), hairline border.

### Phase 4 — Add App Screen
- Search input with 1px hairline border, `rounded-none`, IBM Plex Mono input font.
- App list with rectilinear cards, square icons, uppercase titles, monospace usage notes, and brass "TRACKED TODAY" indicator.
- Step 2 daily allowance picker with rectilinear stepper controls, IBM Plex Mono digits, and rectilinear "LOCK IT IN" primary button.

### Phase 5 — Stats Screen
- "Screen Time" title in Libre Caslon Text.
- Date carousel with rectilinear buttons and uppercase tracked dates.
- 2-column summary card with IBM Plex Mono totals and 7-day averages.
- 7-day flat hairline bar chart with rectilinear bars, brass accent for active selected day, stamp-red for locked day, and rectilinear dot indicator.
- Application breakdown list with rectilinear rows and monospace usage tallies.

### Phase 6 — Settings Screen
- Theme selector with rectilinear segment buttons (`SYSTEM | LIGHT | DARK`).
- Segmented mechanical bracket toggle `[ OFF | ON ]` for `updateAutoCleanSetting` per DESIGN.md line 243.
- Active Today's Locks read-only manifest with rectilinear rows, monospace `LOCKED` / `RUNNING` status labels.
- Device Admin uninstall protection and About Blackout cards styled with rectilinear hairline borders.

### Phase 7 — Native Android Lock Screen & Overlay Reconciliation
- Verified `BlackoutScreen.tsx` is an orphaned route previously retired; the day-to-day enforcement UI is native Android in `BlackoutAccessibilityService.kt`.
- Updated `BlackoutAccessibilityService.kt`:
  - Replaced oval rubber stamp with a rectilinear stamp placard (`shape = RECTANGLE`, `cornerRadius = 0f`, 1px stamp-red stroke, "LOCKED // 24H" in monospace bold).
  - Replaced floating countdown warning with a rectilinear plate with 1px `#2A3145` hairline border and `#EE12161F` dark navy leather ground.
  - Return button updated to rectilinear (`cornerRadius = 0f`) with bone `#E6E8EC` background and dark navy `#12161F` text.

### Phase 8 — Full Consistency Pass & Regression Check
- Grep audit: 0 instances of `border-2`, 0 bare `rounded` / `rounded-full` / `rounded-lg`, 0 shadow utilities, 0 stray hex colors.
- Strict preservation of all business logic: multi-activity screen time tracking, 12h lookback, cumulative warning query, immutable lock expiration, midnight reset, and theme event listener sync.

## What the Founder Should Visually Check on Device:
1. **Typography**: Verify Libre Caslon Text on titles ("Focus", "Screen Time", "Preferences"), Public Sans on body/buttons, and IBM Plex Mono on all numerals, timers, and countdown badges.
2. **Angular Rigidity**: Verify that cards, buttons, badges, FAB, and native lock overlay are completely rectilinear with zero rounded pill styling.
3. **Color Tokens**: Check Light mode (cool slate ledger paper `#E6E8EC`, `#EFF1F4` surface, `#1A2030` ink) and Dark mode (dark navy leather `#12161F`, `#1B2030` surface, `#E6E8EC` bone).
4. **Functional Accents**: Check active allowances in burnished maritime brass (`#A67C3D`) and locked states in stamp red (`#B23A2E`).
5. **Settings Maintenance Toggle**: Inspect the segmented mechanical bracket `[ OFF | ON ]` for Auto-Clean Uninstalled Apps.

