# Frontend State Migrator Design System

## 1. Atmosphere & Identity

Frontend State Migrator is a focused developer utility: calm, explicit, and trustworthy. The visual direction follows Material Design 3 without importing Material Web Components. Its signature is a cool indigo tonal hierarchy over soft blue-gray surfaces: primary actions are immediately visible, data remains inspectable, and every destructive or state-changing action is visually unambiguous.

Primary users are frontend developers moving state during debugging, including keyboard users, users working under time pressure, and users with reduced motion or low-contrast sensitivity. The interface optimizes for scanning, confirmation, and recovery rather than decoration.

## 2. Color

### Palette

All runtime colors are exposed as CSS custom properties in `src/shared/base.css`. Components must use semantic roles, never raw color values.

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Page surface | `--md-sys-color-surface` | `#f9f9ff` | `#111318` | App background |
| Surface dim | `--md-sys-color-surface-dim` | `#dad9e0` | `#111318` | Recessed areas |
| Surface container low | `--md-sys-color-surface-container-low` | `#f3f3fa` | `#1a1c21` | Secondary sections |
| Surface container | `--md-sys-color-surface-container` | `#edecf3` | `#1e2025` | Tonal controls |
| Surface container high | `--md-sys-color-surface-container-high` | `#e7e6ed` | `#292a2f` | Hover and selected states |
| Surface container highest | `--md-sys-color-surface-container-highest` | `#e1e1e8` | `#34353a` | Strong selected states |
| On surface | `--md-sys-color-on-surface` | `#1a1b20` | `#e3e2e9` | Primary text |
| On surface variant | `--md-sys-color-on-surface-variant` | `#45464f` | `#c6c5d0` | Supporting text |
| Outline | `--md-sys-color-outline` | `#767680` | `#90909a` | Field borders |
| Outline variant | `--md-sys-color-outline-variant` | `#c6c5d0` | `#45464f` | Dividers and cards |
| Primary | `--md-sys-color-primary` | `#4f55a7` | `#bec2ff` | Filled action, focus |
| On primary | `--md-sys-color-on-primary` | `#ffffff` | `#202667` | Text on primary |
| Primary container | `--md-sys-color-primary-container` | `#e0e0ff` | `#373d8e` | Selected and tonal action |
| On primary container | `--md-sys-color-on-primary-container` | `#171e60` | `#e0e0ff` | Text on primary container |
| Error | `--md-sys-color-error` | `#ba1a1a` | `#ffb4ab` | Destructive action and errors |
| Error container | `--md-sys-color-error-container` | `#ffdad6` | `#93000a` | Error status surface |
| On error container | `--md-sys-color-on-error-container` | `#410002` | `#ffdad6` | Text on error container |
| Success | `--app-color-success` | `#316b4d` | `#9bd5b2` | Success text and emphasis |
| Success container | `--app-color-success-container` | `#b9f2ce` | `#164f37` | Success status surface |
| On success container | `--app-color-on-success-container` | `#002111` | `#b9f2ce` | Text on success container |
| Code surface | `--app-color-code-surface` | `#202127` | `#0c0e12` | Storage value preview |
| Code text | `--app-color-code-text` | `#f2f0f7` | `#e3e2e9` | Text on code surface |

### Rules

- Accent color is reserved for interaction, selection, and focus.
- Depth is communicated primarily through tonal surface changes, with elevation reserved for the app bar and raised cards.
- Status colors always pair with text or labels; color alone never communicates state.
- `color-scheme` follows the operating-system preference.

## 3. Typography

### Font stack

- Primary: `Roboto`, `Noto Sans SC`, `Noto Sans CJK SC`, `WenQuanYi Micro Hei`, `Segoe UI`, `PingFang SC`, system sans-serif.
- Monospace: `Roboto Mono`, `SFMono-Regular`, `Consolas`, monospace.
- No network font dependency is allowed in the extension runtime.

### Scale

| Level | Token | Size / line height | Weight | Usage |
|---|---|---|---|---|
| Headline large | `--type-headline-large` | `2rem / 2.5rem` | 500 | Options title |
| Headline small | `--type-headline-small` | `1.5rem / 2rem` | 500 | Popup title |
| Title large | `--type-title-large` | `1.375rem / 1.75rem` | 500 | Major section title |
| Title medium | `--type-title-medium` | `1rem / 1.5rem` | 600 | Card title |
| Body medium | `--type-body-medium` | `0.875rem / 1.25rem` | 400 | Default body |
| Body small | `--type-body-small` | `0.75rem / 1rem` | 400 | Metadata |
| Label large | `--type-label-large` | `0.875rem / 1.25rem` | 600 | Buttons and fields |
| Label small | `--type-label-small` | `0.6875rem / 1rem` | 600 | Badges and eyebrow |

Headings use sentence case. Long URLs and storage values may wrap anywhere. Numeric values use tabular figures.

## 4. Spacing & Layout

All spacing derives from a 4px base unit.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Tight inline separation |
| `--space-2` | `8px` | Metadata groups |
| `--space-3` | `12px` | Compact component gap |
| `--space-4` | `16px` | Standard padding |
| `--space-5` | `20px` | Panel padding |
| `--space-6` | `24px` | Section padding |
| `--space-8` | `32px` | Page rhythm |
| `--space-10` | `40px` | Major page separation |
| `--space-12` | `48px` | Options page bottom spacing |

- Popup width: `880px`, capped at the available viewport.
- Options content width: `1040px`, centered with 20px mobile gutters.
- Two-column workspaces collapse below `900px` without changing DOM order.
- Interactive targets are at least 40px high; primary fields and actions target 48px.

## 5. Components

### Outlined field (`app-input`, `app-select`)

- **Structure**: native input/select inside a shadow-root host.
- **Shape**: `--shape-small` (8px), 48px minimum height.
- **States**: outline at rest; primary outline and focus ring on focus; elevated tonal fill on hover; muted tonal fill when disabled.
- **Accessibility**: native keyboard semantics are preserved. The external wrapping-label association is a known Shadow DOM limitation recorded in Section 8.
- **Motion**: color, border-color, and box-shadow over `--motion-short`.

### Selectable card (`app-choice-card`)

- **Structure**: leading native checkbox/radio, content, optional trailing action.
- **Shape**: `--shape-medium` (12px).
- **States**: tonal surface at rest; primary-container tint when checked; state layer on hover; visible focus-within ring; reduced opacity when disabled.
- **Accessibility**: the full content area activates the native control; selected state is never communicated by color alone because the native control remains visible.

### Panel

- **Structure**: semantic `section` with a section heading and content.
- **Variants**: default tonal surface, raised hero/app bar, success result, error result.
- **Shape**: `--shape-large` (16px) or `--shape-extra-large` (24px) for the options hero.
- **Spacing**: popup uses `--space-4`; options uses `--space-5` to `--space-6`.

### Buttons

- **Filled** (`.primary`): highest-emphasis action, primary background.
- **Filled tonal** (`.secondary`, `.success`): medium-emphasis action on a tonal container.
- **Text/error** (`.ghost`, `.danger`): low-emphasis or destructive action.
- **Segmented** (`.mode-button`): two mutually exclusive modes in one surface container.
- **States**: hover state layer, pressed `translateY(1px)`, visible focus ring, clear disabled treatment.
- **Rule**: labels referenced by E2E tests remain unchanged.

### Badge / chip

- **Structure**: short, non-interactive metadata label.
- **Shape**: `--shape-full`.
- **Usage**: storage type, default localhost target, count metadata.

### Status panel

- **Structure**: heading, direct message, optional detail list.
- **Variants**: success and error containers.
- **Accessibility**: rendered result remains visible and text-complete; errors do not rely on color alone.

### Code preview

- **Structure**: block `code` element with wrapped content.
- **Surface**: dedicated dark code surface in both themes.
- **Typography**: monospace body-small.

## 6. Motion & Interaction

| Type | Token | Duration | Easing | Usage |
|---|---|---|---|---|
| Short | `--motion-short` | `150ms` | `cubic-bezier(0.2, 0, 0, 1)` | Hover, focus, press |
| Medium | `--motion-medium` | `250ms` | `cubic-bezier(0.2, 0, 0, 1)` | Surface and mode changes |

- Motion communicates interaction only; no decorative looping motion.
- Pressed controls may translate by 1px. Layout dimensions are never animated.
- Under `prefers-reduced-motion: reduce`, transitions are removed and smooth scrolling is disabled.

## 7. Depth & Surface

Strategy: **mixed tonal surfaces with restrained elevation**.

| Level | Token | Usage |
|---|---|---|
| 0 | tonal shift only | Page and nested content |
| 1 | `--elevation-1` | Panels and selected controls |
| 2 | `--elevation-2` | Options hero and popup app bar |

Elevation shadows are cool-tinted and paired with a subtle outline. Nested cards use tonal shifts rather than stacking multiple shadows.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA: 4.5:1 body text, 3:1 large text and control boundaries.
- Every interactive element has a visible `:focus-visible` or `:focus-within` indicator.
- Native inputs, selects, radios, checkboxes, and buttons remain keyboard reachable.
- Pointer targets are at least 40px high and use adequate spacing.
- `prefers-reduced-motion` and system dark mode are respected.
- Imported data and pending changes remain visible and manually confirmable.
- Existing accessible names and control order used by `test/extension.e2e.test.ts` remain stable.

### Accepted debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Shadow DOM labels depend on the existing wrapping-label pattern | Shared fields | Preserves the current Lit component API and E2E order; explicit native label association is not guaranteed | Replace with explicit `aria-labelledby` when field primitives gain stable IDs |
| Popup width is optimized for desktop extension use | Popup | The workflow presents dense state previews; narrow layouts still collapse responsively | Revisit if a side-panel entry point is added |
