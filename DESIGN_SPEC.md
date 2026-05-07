# Sotto Live Interpreter — Visual Design Spec

Single-bar overlay. No popup. Two states: **Idle** and **Active**, with a slide-up Settings panel.

---

## 1. Design philosophy

Sotto is a calm instrument sitting under the video, not a dashboard sitting on top of it. We keep the neon yellow-green as a single, surgical signature — used for the LIVE pulse, the START button fill, and focus rings only — never as borders, labels, or chrome. Everything else is deep matte black, soft off-white text, and one accent of warmth, so the captions themselves remain the loudest object on screen.

Replaces the popup-era heavy borders and dual-button styles seen in `popup.css:32-90` and `content.css:163-208`.

---

## 2. Color palette

| Token | Hex | Usage |
|---|---|---|
| `--bar-bg` | `#0B0C0A` | Bar background (solid) |
| `--bar-bg-glass` | `rgba(11,12,10,0.78)` | Bar background when transparency > 0 |
| `--surface-1` | `#15161300` overlay `rgba(255,255,255,0.04)` | Settings panel, dropdown menus |
| `--surface-2` | `rgba(255,255,255,0.07)` | Secondary buttons, input fills |
| `--accent` | `#D6FF3D` | START fill, LIVE pulse, focus ring (single-use only) |
| `--accent-soft` | `rgba(214,255,61,0.14)` | Hover wash on accent elements |
| `--text-primary` | `#F4F1E8` | Captions, primary labels |
| `--text-secondary` | `rgba(244,241,232,0.62)` | Dropdown values, ticker, secondary labels |
| `--text-tertiary` | `rgba(244,241,232,0.38)` | Hints, "more voices" group label |
| `--success-pulse` | `#9EE85C` | LIVE dot core (slightly cooler than accent so they don't fight) |
| `--danger` | `#FF6B5C` | Stop button text on hover; never a fill |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Bar top edge, settings dividers |
| `--border-strong` | `rgba(255,255,255,0.14)` | Active segment in mode toggle |

Disabled state: any element drops to `opacity: 0.42`, no color change. Replaces the inconsistent `opacity: 0.72` in `popup.css:179`.

---

## 3. Typography

System stack only:

```
-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", "PingFang SC",
"Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif
```

CJK fonts in the chain ensure captions render cleanly on Bilibili and Xiaohongshu. Removes `"Avenir Next"` from `popup.css:5` and `content.css:13` (unreliable cross-platform).

Type scale (5 steps):

| Step | Size | Weight | Letter-spacing | Use |
|---|---|---|---|---|
| micro | 10px | 600 | +0.04em | Voice group labels ("Best quality"), ticker units |
| caption | 12px | 500 | 0 | Dropdown current value, settings field labels |
| label | 13px | 600 | 0 | Button text (secondary), mode toggle |
| body | 15px | 600 | 0 | START button text |
| hero | 28px / 32px / 38px | 500 | -0.005em | **Captions only** (compact / default / roomy) — line-height 1.32 |

Captions weight 500 (not 720 as in `content.css:221`) — heavy weight at large size strains eyes during long sessions.

---

## 4. Spacing system

8px base, with a 4px half-step.

| Token | Value | Use |
|---|---|---|
| `--sp-xs` | 4px | Icon gaps inside a button |
| `--sp-sm` | 8px | Between adjacent controls |
| `--sp-md` | 12px | Control strip cluster gaps |
| `--sp-lg` | 16px | Bar inner padding (vertical), settings rows |
| `--sp-xl` | 24px | Bar inner padding (horizontal), settings sections |
| `--sp-2xl` | 32px | Caption area top padding |

---

## 5. Bar layout dimensions

- **Position:** bottom-center, `bottom: 16px`. Centered horizontally with `max-width: 880px; width: calc(100vw - 32px)`.
- **Control strip height:** 56px (idle and active — locked so caption area doesn't jump on state change).
- **Caption area height:** auto, `min-height: 96px`, `max-height: 28vh`, scrolls internally if exceeded. Hidden in idle state.
- **Border-radius:** 14px (single value, all corners).
- **Border:** 1px `--border-subtle` only on the top edge of the caption divider; no outer border.
- **Drop shadow:** `0 12px 40px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`.
- **Backdrop:** `backdrop-filter: blur(24px) saturate(1.2)` when transparency > 0.
- **Z-index:** `2147483647` (kept from `content.css:3`).

Replaces the bottom-right anchored `right: 18px; bottom: 92px` in `content.css:6-7`.

---

## 6. Button system

All buttons: 32px height (icon + secondary), 40px height (primary START), 8px border-radius, no border by default.

**Primary — START (idle only)**
- Default: `--accent` fill, `#0B0C0A` text, weight 600, padding 0 24px.
- Hover: brightness(1.08), subtle glow `0 0 0 4px var(--accent-soft)`.
- Active: brightness(0.92), no transform.
- Disabled: opacity 0.42, no hover state.
- Focus: 2px outline `--accent` offset 3px.

**Secondary — gear, hide, voice picker trigger**
- Default: transparent fill, `--text-secondary`.
- Hover: `--surface-2` fill, `--text-primary`.
- Active: `--surface-2` darker, `--text-primary`.
- Focus: same outline rule.

**Destructive — Stop**
- Default: transparent fill, `--text-secondary`, label "Stop".
- Hover: `rgba(255,107,92,0.10)` fill, `--danger` text.
- No red fill ever — destructive is communicated by hover only.

**Icon-only — pause/resume, hide, gear, close**
- 32×32px hit area, 18px icon. Same color rules as Secondary.

**Segmented toggle (mode):** see §7.

Removes the `border: 1px solid` from secondary buttons in `content.css:184` — borders read as cluttered against captions.

---

## 7. Mode toggle component (Voice / Text)

Pill-shaped segmented control with a sliding indicator. Lives idle-state only.

- Container: 32px height, `--surface-2` background, 999px radius, padding 3px.
- Segments: equal-width, 13px label weight 600, icon + label inline ("🎙 Voice", "💬 Text").
- Active indicator: `--accent` fill, `#0B0C0A` text, 999px radius, slides via `transform` (200ms ease-out). Adds `0 1px 2px rgba(0,0,0,0.3)` shadow.
- Inactive segment: `--text-secondary`.
- Width: ~180px total.

When **Text** is selected, the voice-picker dropdown to its right fades to opacity 0.42 and goes `pointer-events: none`.

---

## 8. Cost ticker treatment

Plain text, monospace digits, no pill, no border. Lives in the active control strip, just left of the pause button.

```
00:42 · $0.02
```

- Font: `ui-monospace, SF Mono, Menlo, monospace`
- Size: 12px
- Color: `--text-secondary`
- Letter-spacing: 0
- Separator: middle dot ` · ` in `--text-tertiary`
- The digits use `font-variant-numeric: tabular-nums` so they don't jitter as they tick.

No background, no border, no animation — informational, not anxious. If session exceeds $5.00, the dollar amount only shifts to `--text-primary` weight 700 (a quiet emphasis, no color shift).

---

## 9. Settings panel

Slides up from the bar, attached to the bar's top edge — same width, same border-radius on top corners, flat on bottom (visually merges with bar).

- **Animation in:** translateY(8px) → 0, opacity 0 → 1, 220ms cubic-bezier(0.32, 0.72, 0, 1).
- **Background:** `--bar-bg` solid (always solid, ignores transparency setting — settings need to be readable).
- **Padding:** 20px 24px.
- **Max-height:** 360px, scrolls internally.
- **Internal layout:** single column, sections separated by 1px `--border-subtle` and `--sp-xl` vertical gap.
- Section order: API key → Defaults (mode/voice/language) → Transparency → Advanced bridge (collapsed by default, disclosure triangle).
- Each row: label (caption, 12px, `--text-tertiary`) above input; inputs full-width.
- API key field: `type="password"`, monospace font, eye-icon toggle on the right (Secondary button rules).
- Close: X icon top-right of panel, OR click outside, OR re-click gear.

---

## 10. Caption typography rules

- Font: system stack from §3 (CJK-safe).
- Size: 32px default. Slider in settings adjusts between 24/32/38px.
- Weight: 500.
- Line-height: 1.32.
- Letter-spacing: -0.005em.
- Color: `--text-primary`.
- Max characters per line: ~52 at default size — enforced by `max-width: 760px` on the caption text container, not by character counting.
- Padding: 20px 32px.
- Text-align: left.
- **Current vs history:** only the most recent finalized line is shown at full opacity. The previous line (one only) is shown above it at opacity 0.45, no animation between. In-progress (streaming) text is full opacity with a subtle 1px right-edge accent bar (`--accent`, 70% height, animated opacity pulse 1.4s) to signal "still arriving."
- Removes the multi-history scroll list from `content.css:298-307` — it's noise during active viewing. Full transcript is accessible only via a "Transcript" button in settings.

---

## 11. Transparency control UX

**Recommendation: quick-access in the bar AND default in settings.**

In the bar's active-state control strip, add a small icon-button (droplet or contrast glyph, 20px icon, Secondary button rules). Click opens a 3-button popover directly above it: `Solid · 70% · 40%`. One tap, popover dismisses.

The settings panel keeps the full 0–100% slider for fine control + sets the default for next session.

Rationale: Fanis flips transparency mid-video when the subtitle area gets dark/light — making him open a settings panel for that is friction. The 3-preset popover is the 90% case.

---

## 12. Mobile / narrow viewport

Breakpoint at 640px viewport width.

Below 640px:
- Bar width = `calc(100vw - 16px)`, bottom inset 8px.
- Caption font drops to 22px.
- **Hidden in active state:** voice indicator (just shows LIVE dot + "LIVE"), cost ticker collapses to `$0.02` only (timer hidden).
- **Hidden in idle state:** mode toggle labels collapse to icons only ("🎙" / "💬"), voice picker shows only the voice name (no group hint).
- Hide button still present — if user hides bar, the floating pill is 44×44px, bottom-right `bottom: 16px; right: 16px`.

Below 380px: hide cost ticker entirely. Captions stay.

---

## 13. Animation / motion

| Element | Duration | Easing |
|---|---|---|
| Bar appearance (extension icon click) | 240ms | `cubic-bezier(0.32, 0.72, 0, 1)` — slide up 12px + fade |
| Settings panel slide-up | 220ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Settings panel dismiss | 160ms | `cubic-bezier(0.4, 0, 1, 1)` |
| Button hover (color/bg) | 120ms | `ease-out` |
| Button press (active) | 80ms | `ease-out` |
| Mode toggle indicator slide | 200ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| LIVE pulse dot | 1600ms | `ease-in-out` infinite — opacity 1 → 0.4 → 1, scale 1 → 1.15 → 1 |
| Idle → Active transition | 280ms | `cubic-bezier(0.32, 0.72, 0, 1)` — caption area expands from 0 to min-height, controls cross-fade |
| Active → Idle (Stop) | 200ms | `ease-out` — caption area collapses, last caption fades out |
| Hide → pill | 200ms | `cubic-bezier(0.32, 0.72, 0, 1)` — bar scales to 0.96 + fades, pill scales in from 0.8 |
| Caption text appearance | none | New text appears instantly. No typewriter, no fade — the streaming bar (§10) is the only motion. |
| Focus ring | 0ms in, 120ms out | Instant on, fade off — accessibility |

`prefers-reduced-motion: reduce` — all transitions drop to 0ms, LIVE pulse becomes static dot.

---

**Implementation note for developer:** the legacy `popup.html` / `popup.css` / `popup.js` files can be deleted entirely. The new bar replaces both `popup.*` and the existing `content.css` overlay panel. Carry forward only the z-index value (`content.css:3`), the SVG brand mark asset, and the drag-handle behavior from `content.css:102-103`.
