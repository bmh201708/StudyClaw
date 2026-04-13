# Design System: The Radiant Sanctuary

## 1. Overview & Creative North Star
The design system for StudyClaw is guided by the Creative North Star: **The Radiant Sanctuary**. Unlike traditional educational platforms that feel rigid or clinical, this system is designed to feel like a sun-drenched creative studio. It moves beyond "standard" UI by prioritizing emotional resonance, tactile depth, and a healing atmosphere.

To break the "template" look, this system utilizes:
- **Intentional Asymmetry:** Avoid perfect grid symmetry. Overlap organic decorative elements with structured content to create a sense of life and motion.
- **Tonal Depth:** Replacing harsh borders with soft, nested layers of warmth.
- **Breathable Scale:** High-contrast typography scales and moderate white space to ensure the interface never feels "busy" or "frictional."

## 2. Colors & The "No-Line" Philosophy
The palette is built on a foundation of soft creams and sun-drenched pastels, designed to reduce cognitive load and evoke a sense of calm.

### Color Tokens
- **Primary (The Glow):** `#ffb6ab` (Used for focused intent)
- **Secondary (The Growth):** `#A8E6CF` (Used for progression and success)
- **Tertiary (The Spark):** `#FFD1FF` (Used for creative highlights)
- **Neutral (The Base):** `#FFF9F0` (The primary warmth)

### The "No-Line" Rule
Traditional 1px borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through:
1. **Background Color Shifts:** Use `surface-container-low` for secondary sections sitting on a `surface` background.
2. **Soft Tonal Transitions:** Let one color bleed into the next to maintain a fluid, organic feel.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, fine papers. Use the `surface-container` tiers to create hierarchy:
- **Layer 1 (The Base):** `surface`
- **Layer 2 (The Section):** `surface-container-low`
- **Layer 3 (The Card/Component):** `surface-container-lowest` (pure white `#ffffff`) to create a soft "lift" from the warm cream base.

### Signature Textures
Use gradients to provide "soul." For primary CTAs or hero moments, transition from `primary` (`#ffb6ab`) to a complementary lighter shade (e.g., a lighter orange/pink). Apply a subtle grain texture or soft glassmorphism (backdrop-blur) to floating elements to mimic the quality of frosted glass in a sunlit room.

## 3. Typography: Editorial Warmth
The typography utilizes two distinct sans-serifs to balance modern efficiency with friendly approachability.

### Typography Scale
- **Display (Plus Jakarta Sans):** Large, expressive headlines (`display-lg`: 3.5rem). Use these for "Moment of Calm" screens.
- **Headlines (Plus Jakarta Sans):** Clean and authoritative yet soft. Used for major content blocks.
- **Body & Titles (Be Vietnam Pro):** High legibility with moderate letter spacing to ensure the "creative sanctuary" feels airy and readable.

**The Editorial Rule:** Headlines should often be "broken" across lines in intentional ways or paired with organic decorative blobs to avoid a "corporate" feel.

## 4. Elevation & Depth
Depth in this design system is achieved through **Tonal Layering** rather than traditional structural lines.

### The Layering Principle
Stack containers to define importance. A `surface-container-lowest` card placed on a `surface-container-low` section creates a natural, soft lift.

### Ambient Shadows
When a floating effect is required (e.g., a primary Action Button), use an **Ambient Shadow**:
- **Blur:** 24px - 48px
- **Opacity:** 4% - 8%
- **Tint:** Use a tinted version of `on-surface` (a desaturated, slightly darker version of `neutral_color_hex`) rather than pure black to keep the shadow "warm."

### The "Ghost Border" Fallback
If a border is required for accessibility, it must be a **Ghost Border**: Use the `outline-variant` token at **15% opacity**. High-contrast, 100% opaque borders are forbidden.

### Glassmorphism
For navigation bars or floating modals, use `surface` colors with a 70% opacity and a `backdrop-filter: blur(20px)`. This allows the "Radiant Sanctuary" colors to bleed through, softening the edges of the UI.

## 5. Components

### Buttons
- **Primary:** Maximum roundedness with a gradient from `primary` to a complementary lighter shade. Soft ambient shadow.
- **Secondary:** Semi-transparent `secondary-container` with no border.
- **Tertiary:** No background; `primary` text with an icon and 0.05em letter spacing.

### Cards & Lists
- **The Divider Rule:** Forbid the use of divider lines. Use vertical white space or a subtle shift from `surface-container` to `surface-container-high` to separate items.
- **Shapes:** All cards must use maximum roundedness to reinforce the "organic" feel.

### Input Fields
- **Style:** Filled style using `surface-container-highest`. No bottom line.
- **Corners:** Maximum roundedness.
- **States:** On focus, use a `primary` "Ghost Border" (20% opacity) and a soft inner glow.

### Interactive "Blobs"
- Use `tertiary-container` or `secondary-container` to create organic, non-geometric shapes that sit behind content. These should have a slight "float" animation to feel tactile and alive.

## 6. Do's and Don'ts

### Do:
- **Do** use moderate white space.
- **Do** overlap elements slightly to create a layered, editorial look.
- **Do** use "Plus Jakarta Sans" for all emotive, large-scale text.
- **Do** use the `full` (9999px) radius for small tags and chips.

### Don't:
- **Don't** use pure black (`#000000`) or pure grey. Use `on-surface` (derived from `neutral_color_hex`) for all text.
- **Don't** use 1px solid dividers or borders.
- **Don't** use sharp corners. The minimum radius for any major component is `maximum` (pill-shaped).
- **Don't** clutter the screen. If a screen feels "tight," increase the background tonal contrast instead of adding lines.

---
*This design system is a living document intended to guide the creation of a calm, frictionless, and inspiring digital sanctuary for StudyClaw users.*