---
name: Monolith Minimalist
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  margin-page: 24px
  gutter-grid: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  touch-target: 48px
---

## Brand & Style

The design system is built on the principle of extreme focus and digital asceticism. It targets individuals seeking to reclaim their cognitive load through a UI that refuses to compete for attention. The aesthetic is a fusion of **Minimalism** and **High-Contrast Boldness**, drawing inspiration from high-end editorial design and utility-first productivity tools. 

The visual language is characterized by an absolute rejection of decorative elements—no shadows, no gradients, and no organic textures. The emotional response should be one of "structured silence," providing a neutral canvas that highlights only the most essential user actions.

## Colors

The palette is strictly achromatic to ensure maximum legibility and zero emotional bias. 

- **Primary (#000000):** Used for all high-emphasis text, primary buttons, and structural borders.
- **Secondary (#888888):** Reserved for supporting information, disabled states, and metadata.
- **Tertiary (#EEEEEE):** Used for subtle background containers, dividers, and inactive toggle tracks.
- **Neutral (#FFFFFF):** The base surface color, ensuring a stark, paper-like background.

Functional status (errors or success) should be handled via iconography and weight rather than introducing new hues, maintaining the "Blackout" philosophy.

## Typography

The design system utilizes **Inter** for its systematic, utilitarian precision. 

- **Headlines:** Use Bold (700) weight with tight letter-spacing to create a "blocky," authoritative presence. 
- **Body:** Use Regular (400) weight for maximum readability. Line heights are kept generous to prevent visual clutter in text-heavy lists.
- **Labels:** Use uppercase Bold for category headers and navigation labels to create a distinct hierarchy without relying on color.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for a 390px width mobile viewport. 

- **Margins:** A consistent 24px outer margin ensures content feels centered and monumental.
- **Rhythm:** An 8px linear scale governs all vertical stacking. Components are separated by 16px (Medium) for related items and 32px (Large) for distinct sections.
- **Touch Points:** All interactive elements must maintain a minimum 48px height to ensure accessibility, even when the visual element (like a text link) appears smaller.

## Elevation & Depth

This design system rejects physical metaphors of depth. 
- **Flat Planes:** Hierarchy is achieved through **Tonal Layers** (using #EEEEEE for background elements) and **Bold Borders** (1px or 2px solid #000000).
- **No Shadows:** Shadows are strictly prohibited. 
- **Interaction:** Depth is signaled through inversion. When a component is pressed, the surface should invert (White becomes Black, Black becomes White).

## Shapes

The shape language is "Soft" but leans toward industrial precision. 
- **Base Radius:** 4px (Soft) for buttons and input fields to keep the UI from feeling aggressive while maintaining a professional, structured look.
- **Container Radius:** 8px (Large) for cards and modals to provide a slight distinction between the container and the elements within it.

## Components

- **Buttons:** Primary buttons are solid #000000 with #FFFFFF text. Secondary buttons are 1px solid #000000 borders with no fill.
- **Inputs:** Simple bottom-border (2px) or full 1px border. No background fill unless focused (#EEEEEE).
- **Icons:** Must be 1.5px or 2px stroke width, monochrome line icons only. No filled versions unless representing an active state.
- **Lists:** Separated by 1px horizontal rules (#EEEEEE). High-density layout with 16px vertical padding.
- **Toggles:** Rectangular or minimally rounded tracks. Use high-contrast state changes (Black/White) rather than color to indicate "On."
- **Cards:** Defined by a 1px solid #000000 border. No background fill.
- **Motion:** Transitions should be instantaneous 200ms fades. Scale-on-tap should be a subtle reduction to 98% to provide tactile feedback without breaking the flat aesthetic.