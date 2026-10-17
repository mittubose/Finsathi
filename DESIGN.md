---
name: Retro-Terminal Dark
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#b9ccb2'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#84967e'
  outline-variant: '#3b4b37'
  surface-tint: '#00e639'
  primary: '#ebffe2'
  on-primary: '#003907'
  primary-container: '#00ff41'
  on-primary-container: '#007117'
  inverse-primary: '#006e16'
  secondary: '#ffd79b'
  on-secondary: '#432c00'
  secondary-container: '#ffb211'
  on-secondary-container: '#6b4800'
  tertiary: '#fff8f4'
  on-tertiary: '#442b10'
  tertiary-container: '#ffd5ae'
  on-tertiary-container: '#7a5b3c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72ff70'
  primary-fixed-dim: '#00e639'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#00530e'
  secondary-fixed: '#ffdeae'
  secondary-fixed-dim: '#ffba3f'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#604100'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#e7bf99'
  on-tertiary-fixed: '#2c1701'
  on-tertiary-fixed-variant: '#5d4124'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  data-display:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin: 24px
---

## Brand & Style

This design system is defined by a **Retro-Minimalist** aesthetic that blends the raw, functional utility of early 80s terminal interfaces with modern, polished glassmorphism. It is designed for a financial tracking app where precision and clarity are paramount, evoking a sense of "digital vault" security.

The personality is cold, disciplined, and sophisticated. It targets power users who value information density over decorative fluff. By stripping away standard "friendly" UI tropes and utilizing a high-contrast monochromatic base with neon "instrument" accents, the system creates a focused environment where data is the hero. The emotional response is one of total control, professional-grade tooling, and a nod to technical nostalgia.

## Colors

The palette is strictly functional. The primary background is a pure black (#000000) to maximize contrast and focus. 

- **Primary Accent (Neon Green):** Used exclusively for "Active," "Safe," or "Positive" status indicators and critical CTA highlights.
- **Secondary Accent (Amber):** Reserved for warnings, "Pending," or "Neutral-Alert" states.
- **Monochromatic Grays:** Used for structural depth. White (#FFFFFF) is reserved for primary headlines and critical values. Dimmed grays handle metadata, labels, and non-interactive text to establish a clear hierarchy.
- **Translucency:** Glassmorphism layers use a very low opacity white (5%) to create separation without muddying the dark aesthetic.

## Typography

This design system utilizes a dual-font strategy to separate UI navigation from data consumption.

- **Inter (Sans-Serif):** Used for long-form text, descriptions, and settings to ensure maximum legibility and a modern feel.
- **Space Grotesk (Geometric Mono-style):** Used for headlines, numbers, and status labels. Its technical, slightly futuristic character reinforces the retro-tech narrative. 
- **Formatting:** All currency values, timestamps, and account numbers must use the monospaced stylistic set of Space Grotesk to ensure vertical alignment in tables and lists. Labels are typically set in uppercase with increased letter spacing for a "terminal" readout look.

## Layout & Spacing

The layout follows a strict **Fixed Grid** philosophy. A 12-column grid is used for desktop views, with elements snapped to 4px increments to maintain a "pixel-perfect" technical aesthetic.

- **Dot-Grid Background:** A subtle 24px x 24px dot grid is present on the base layer to provide a blueprint-like structure for the UI components.
- **Information Density:** Spacing is compact. The system prioritizes data visibility over whitespace, though margins are preserved at the edges of the screen (24px) to prevent a cluttered feel.
- **Alignment:** All elements must align to the top-left of their grid containers, mimicking command-line interfaces.

## Elevation & Depth

Depth is achieved through **Glassmorphism** and layering rather than traditional shadows.

1.  **Base Layer (Level 0):** Pure black with a subtle gray dot-grid.
2.  **Surface Layer (Level 1):** Subtle glass cards. `background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(12px);`. These have a 1px border (`rgba(255, 255, 255, 0.1)`) to define their edges.
3.  **Active/Hover Layer (Level 2):** Increased border opacity and a faint inner glow using the primary accent color (Neon Green) at 10% opacity.

Shadows are entirely absent. Separation is created solely through fine lines and backdrop blur effects.

## Shapes

The design system uses a **Sharp (0px)** corner radius for all primary containers, buttons, and input fields. This reinforces the brutalist, retro-tech nature of the interface. 

The only exception to the sharp-corner rule is for circular status pips or specific iconography. All structural UI elements—cards, dividers, and modal overlays—must remain strictly rectangular.

## Components

- **Buttons:** Rectangular with 1px borders. Primary buttons use a solid white fill with black text. Secondary buttons are transparent with a white border. Hover states should "invert" (Black background becomes primary accent color).
- **Cards/Widgets:** Utilizes the Level 1 Glassmorphism style. Headers within cards should be separated by a 1px horizontal line.
- **Inputs:** Simple underlined fields or 4-sided boxes with 1px gray borders. Active focus is indicated by the border changing to Neon Green.
- **Data Lists:** High-density rows with thin 1px dividers. Alternating row highlights are not used; instead, hover states use a slight increase in background opacity (up to 8%).
- **Icons:** Thin-stroke (1px) linear icons. Icons should never be filled; they should appear as wireframes.
- **Financial Indicators:** Percentage changes (up/down) utilize the accent colors (Green for up, Amber for down) but only for the text/number itself, not the container.
- **Progress Bars:** Segmented bars (dot-matrix style) rather than smooth continuous fills to match the retro-tech theme.