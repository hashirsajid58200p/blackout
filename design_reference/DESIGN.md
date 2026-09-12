---
name: Vintage Minimalist Ledger
colors:
  surface: '#fef9ee'
  surface-dim: '#dedacf'
  surface-bright: '#fef9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e8'
  surface-container: '#f2ede2'
  surface-container-high: '#ede8dd'
  surface-container-highest: '#e7e2d7'
  on-surface: '#1d1c15'
  on-surface-variant: '#4c463f'
  inverse-surface: '#323029'
  inverse-on-surface: '#f5f0e5'
  outline: '#7e766e'
  outline-variant: '#cfc5bc'
  surface-tint: '#645d57'
  primary: '#16120d'
  on-primary: '#ffffff'
  primary-container: '#2b2621'
  on-primary-container: '#958d86'
  inverse-primary: '#cec5bd'
  secondary: '#665d52'
  on-secondary: '#ffffff'
  secondary-container: '#eee0d2'
  on-secondary-container: '#6d6358'
  tertiary: '#161106'
  on-tertiary: '#ffffff'
  tertiary-container: '#2c2618'
  on-tertiary-container: '#968d7a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ebe1d9'
  primary-fixed-dim: '#cec5bd'
  on-primary-fixed: '#1f1b16'
  on-primary-fixed-variant: '#4c4640'
  secondary-fixed: '#eee0d2'
  secondary-fixed-dim: '#d2c4b7'
  on-secondary-fixed: '#211a12'
  on-secondary-fixed-variant: '#4e453b'
  tertiary-fixed: '#ede1cc'
  tertiary-fixed-dim: '#d0c5b1'
  on-tertiary-fixed: '#201b0e'
  on-tertiary-fixed-variant: '#4d4636'
  background: '#fef9ee'
  on-background: '#1d1c15'
  surface-variant: '#e7e2d7'
  paper-bg: '#E6E8EC'
  paper-surface: '#EFF1F4'
  ink-primary: '#1A2030'
  ink-secondary: '#5C6478'
  hairline: '#C9CDD6'
  espresso-bg: '#12161F'
  espresso-surface: '#1B2030'
  bone-primary: '#E6E8EC'
  bone-secondary: '#8C93A6'
  hairline-dark: '#2A3145'
  stamp-red: '#B23A2E'
  sage-olive: '#4F7566'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 38px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 30px
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.14em
  mono-timer:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.04em
  mono-data:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

# Design System: Vintage Minimalist (Blackout)

## Concept & Archetype
Blackout is an analog-inspired, ledger-style digital wellbeing / app-blocking native Android utility. Inspired by permission cards, library checkout cards, train ticket stubs, passport stamps, and index catalogs (Aesop, Kinfolk editorial calm).

## Core Principles & Negative Constraints
- Explicitly avoid: neon/saturated color, glassmorphism, drop shadows, gradients, rounded bubbly pill buttons, generic SaaS dashboards, stock illustration, duotone icons.
- No logo or logomark or branding pass — plain text "BLACKOUT" set in Fraunces/Inter.
- Depth comes strictly from 1px hairlines and flat paper/ink layering.
- Dividers: 1px hairlines and ticket tear-off dashed perforations.
- Subtle paper-grain texture feel, 2-4px crisp trimmed corners.

## Color Palette
### Light Mode ("Cool Slate Paper & Navy Ink")
- Paper Background: #E6E8EC
- Paper Surface / Card: #EFF1F4
- Ink (Primary Text): #1A2030
- Ink Secondary / Muted: #5C6478
- Hairline / Border: #C9CDD6

### Dark Mode ("Deep Navy Ink & Slate White")
- Espresso Background: #12161F
- Espresso Surface / Card: #1B2030
- Bone (Primary Text): #E6E8EC
- Bone Secondary / Muted: #8C93A6
- Hairline / Border: #2A3145

### Accents (Used sparingly for stamps, indicators, progress)
- Locked / Warning (Rubber-stamp Red): #B23A2E
- Unlocked / Safe (Aged Bronze / Verdigris Green): #4F7566

## Typography
- Display / Headlines: "Fraunces", serif (Google Fonts), weight 500-600, soft vintage character.
- Body / UI Labels / Navigation: "Inter", clean, quiet, sans-serif.
  - Section headers & metadata: Inter, uppercase, tracking-widest (11-12px).
- Numerals & Timers & Figures: "IBM Plex Mono", monospace ledger/typewriter feel.

## Layout & Components
- Device: Android portrait mobile (390px - 412px).
- Buttons: 2-4px border radius, ink fill with paper text or 1px hairline outline, uppercase Inter tracking-widest.
- Badges / Stamps: Stamped-looking border, 3-5° tilt for locked rubber-stamp marks.
- Navigation: Minimal hairline top/bottom chrome, 1.25px thin line icons.
