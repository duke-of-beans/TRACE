# TRACE Design System v1.0

## Philosophy

TRACE should feel like a **trusted, quiet tool that gets out of your way.**

Not flashy. Not military. Not techno. Not "AI-generated."
The confidence of a well-made notebook. The clarity of a clean form.
The calm of a tool that knows what it's doing so the user doesn't have to think about it.

### Design References (spirit, not copy)
- **Signal** - security-first but doesn't look paranoid. Clean, human, trustworthy.
- **Linear** - professional tool with restrained color. Good type hierarchy. Spacious.
- **Apple Notes** - unremarkable on screen. Nobody looks twice. Just a form.

### Anti-References
- Palantir (too military)
- Any "cyber dashboard" (too attention-grabbing)
- Material Design defaults (too Google-generic)
- Dark-mode-cyan-accent anything (too AI-boilerplate)

---

## Users & Context

### Reporters
- Regular people, not tech workers
- Using phones in cars or on foot, often one-handed
- Daylight and nighttime use
- Varying ages, tech literacy, vision quality
- Under stress, multitasking, distracted
- **The app must look unremarkable if someone glances at their screen**

### Operators
- Chapter leaders, more tech-literate
- Laptops/desktops at home or safe locations
- Long analytical sessions (hours)
- Making consequential decisions
- Need clarity and low eye strain

---

## Color Palette — Slate + Indigo

### Why Indigo
Reads as "professional" without being cold like cyan. Doesn't scream any industry.
Works in both light and dark modes. Serious but not clinical.

### Why Slate
Warmer than pure gray. Less fatiguing for long sessions. Slightly warm undertone
reads as "thoughtful" not "technical."

### Light Mode (reporter default)
```
--bg:          #F8FAFC    /* barely warm white */
--surface:     #FFFFFF
--surface-alt: #F1F5F9    /* subtle card differentiation */
--text:        #1E293B    /* warm dark, not pure black */
--text-sec:    #64748B    /* secondary / labels */
--text-muted:  #94A3B8    /* metadata, timestamps */
--border:      #E2E8F0
--border-focus:#4F46E5    /* focus rings */
--accent:      #4F46E5    /* indigo-600 */
--accent-hover:#4338CA    /* indigo-700 */
--accent-soft: #EEF2FF    /* indigo-50, subtle backgrounds */
--accent-text: #FFFFFF    /* text on accent buttons */
```

### Dark Mode (operator default)
```
--bg:          #0F172A    /* deep slate, not pure black */
--surface:     #1E293B
--surface-alt: #334155
--text:        #F1F5F9
--text-sec:    #94A3B8
--text-muted:  #64748B
--border:      #334155
--border-focus:#818CF8
--accent:      #818CF8    /* lighter indigo for dark bg */
--accent-hover:#6366F1
--accent-soft: #1E1B4B    /* indigo-950 */
--accent-text: #FFFFFF
```

### Status Colors (both modes)
```
--danger:      #DC2626    /* red-600 */
--danger-soft: #FEF2F2    /* light: red-50 / dark: #2D1B1B */
--warning:     #D97706    /* amber-600 */
--warning-soft:#FFFBEB    /* light: amber-50 / dark: #2D2510 */
--success:     #16A34A    /* green-600 */
--success-soft:#F0FDF4    /* light: green-50 / dark: #1B2D1B */
```

### Mode Defaults
- **Reporter PWA**: Light mode default (daylight use, camouflage, accessibility)
- **Operator Dashboard**: Dark mode default (analyst preference, long sessions)
- Both include a toggle. User choice persists.

---

## Typography

### Font Stack
```
-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif
```
No custom fonts. Feels native. Zero load time. No FOUT.

Monospace (plates, codes, data):
```
"SF Mono", "Cascadia Code", "Fira Code", ui-monospace, monospace
```

### Scale
| Token     | Size | Use |
|-----------|------|-----|
| text-xs   | 11px | Timestamps, metadata |
| text-sm   | 13px | Labels, secondary text |
| text-base | 15px | Body text (mobile) / 14px (desktop) |
| text-lg   | 17px | Emphasized body, card titles |
| text-xl   | 20px | Section headers |
| text-2xl  | 24px | Page titles |
| text-3xl  | 32px | Display (splash/login only) |

### Line Heights
- Body: 1.5 (readability)
- Headings: 1.3
- Display: 1.2
- Compact (data tables): 1.4

### Font Weights
- 400: body text
- 500: labels, secondary emphasis
- 600: card titles, nav items
- 700: page titles, headings

---

## Spacing

4px base unit. Use only these values:
```
--sp-1:  4px
--sp-2:  8px
--sp-3:  12px
--sp-4:  16px
--sp-5:  20px
--sp-6:  24px
--sp-8:  32px
--sp-10: 40px
--sp-12: 48px
--sp-16: 64px
```

---

## Border Radius
```
--radius-sm: 4px    /* pills, small badges */
--radius:    8px    /* buttons, inputs, cards */
--radius-lg: 12px   /* panels, modals */
--radius-xl: 16px   /* large containers */
--radius-full: 9999px  /* circular elements */
```

---

## Shadows
Light mode only. Dark mode uses borders instead.
```
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow:     0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)
--shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)
```

---

## Icons

Custom SVG. 24x24 viewBox. 1.5px stroke. `currentColor` fill/stroke.
No emoji anywhere. Every icon is geometric, clean, monochrome.

### Icon Set
| Name | Use | Description |
|------|-----|-------------|
| camera | Photo capture | Circle + inner lens |
| clock | History | Circle + hands |
| sliders | Settings | Three horizontal sliders |
| shield | Security | Shield outline |
| lock | PIN lock | Padlock |
| unlock | Unlocked state | Open padlock |
| arrow-up | North direction | Arrow pointing up |
| arrow-ne | NE direction | Arrow at 45° |
| (etc for all 8 directions) | | |
| alert-triangle | Warning | Triangle + exclamation |
| check | Success/confirm | Checkmark |
| x | Close/dismiss | X |
| chevron-right | Navigation | Right-pointing chevron |
| plus | Add/create | Plus sign |
| eye | View/record | Eye outline |
| trash | Delete | Trash can |
| send | Submit | Paper plane |
| compass | Direction picker | Compass rose |
| user | Actor/reporter | Person silhouette |
| car | Vehicle | Car side profile |
| map-pin | Location | Map pin |
| radio | Live/connected | Radio waves |
| zap | Triage/urgent | Lightning bolt |
| grid | Dashboard | 4-square grid |
| log-out | Sign out | Arrow leaving box |
| skull | Kill/nuke | Skull (danger) |

---

## WCAG Compliance

### Audit Status: COMPLETE (v1.0)

### Contrast Ratios (minimum)
- Normal text: 4.5:1 (AA) ✅ Verified — Slate palette exceeds minimum
- Large text (18px+): 3:1 (AA) ✅
- UI components: 3:1 (AA) ✅

### Touch Targets
- Minimum: 44x44px on all interactive elements ✅
- All buttons, inputs, nav items meet minimum

### Focus Indicators
- 2px solid outline using --border-focus ✅
- 2px offset for visibility ✅
- Applied via :focus-visible in tokens.css ✅

### Skip Navigation
- Reporter PWA: skip-nav link (visible on focus) ✅
- Operator Dashboard: keyboard shortcuts (?), numbered nav (1-7) ✅

### ARIA
- All icon-only buttons: aria-label ✅
- All inputs: associated <label> elements ✅
- Status messages: role="status" + aria-live="polite" on toasts ✅
- Modals: role="dialog", aria-modal="true" ✅
- Navigation: role="navigation", aria-label ✅
- Direction buttons: aria-pressed for toggle state ✅

### Motion
- @media (prefers-reduced-motion: reduce) in tokens.css ✅
- Animations reduced to 0.01ms ✅
- No essential information conveyed through animation ✅

### Color Independence
- Status colors always paired with icons AND text labels ✅
- Direction buttons use arrow icons + text, not color alone ✅
- Concern levels have color + label + rank number ✅

### Semantic HTML
- Proper heading hierarchy (h1 → h2 → h3) ✅
- Navigation landmarks (nav, main, aside) ✅
- Form labels and fieldsets ✅

---

## Component Patterns

### Buttons
- Primary: accent bg, white text, 44px min height
- Secondary: transparent bg, accent text, accent border
- Danger: danger bg, white text
- Ghost: transparent bg, text-sec color, no border
- All: radius-md, 600 weight, 13-14px text

### Inputs
- 44px min height
- radius-md border
- border color, focus: border-focus + ring
- placeholder: text-muted
- label above, always visible (not floating)

### Cards
- surface bg, border, radius-lg
- 16-24px padding
- Light mode: subtle shadow. Dark mode: border only.

### Navigation (Reporter)
- Bottom tab bar, 3 items max
- SVG icons + text label
- Active: accent color. Inactive: text-muted

### Navigation (Operator)
- Sidebar, fixed width
- SVG icons + text labels
- Active: accent-soft bg + accent text
- Hover: surface-alt bg

---

## File Structure
```
shared/
  design/
    tokens.css       <- CSS custom properties
    icons.tsx        <- SVG icon components (shared)
    theme.ts         <- Theme toggle logic
```

---

## Wordmark (Unified Brand Lockup)

The TRACE wordmark uses the same structure across all portals and documentation.
Four elements, top to bottom:

1. **"TRACE"** in Exo 2 Thin (100), accent color, 0.22em letter-spacing
2. **Hairline rule** at accent color, 50% opacity, matching text width
3. **Expansion** "Tracking · Reporting · Analysis · Community Evidence" in 9-10px uppercase
4. **Context label** (optional): "Field Reporter", "Operator Console", "Chapter Setup Guide"

### Size Presets
| Context | TRACE size | Expansion size | Used in |
|---------|-----------|----------------|---------|
| lg      | 40px      | 10px           | guide.html hero, operator login |
| md      | 28px      | 9px            | reporter pin lock |
| sm      | 18px      | omitted        | footer, inline references |

### Rules
- Exo 2 Thin (weight 100) for the wordmark text only. Below 20px, bump to weight 200.
- Expansion uses system font, not Exo 2.
- Mid-dots (·) separate the expansion words, not commas or ampersands.
- Context label uses system font, 10-11px, muted color, uppercase, 2px letter-spacing.
- The rule line matches the width of the parent container, not the text.

---

## Tag Colors

Tags use the existing status palette. Each context has a default set:

### Sighting Tags
| Label | Color | Use |
|-------|-------|-----|
| Confirmed Suspicious | #DC2626 (danger) | Verified threat |
| Cleared - Resident | #16A34A (success) | Known, not suspicious |
| Known Delivery Vehicle | #64748B (slate) | Commercial, expected |
| Under Active Tracking | #D97706 (warning) | Being monitored |
| Duplicate Report | #94A3B8 (muted) | Already filed |
| Requires Follow-Up | #4F46E5 (accent) | Needs more info |

### Vehicle Tags
| Label | Color | Use |
|-------|-------|-----|
| Active Concern | #DC2626 | Confirmed operational |
| Monitoring | #D97706 | Watch list |
| Cleared | #16A34A | No longer suspicious |
| Noted for Authorities | #7C3AED | Referred to authorities |
| Known Resident | #64748B | Identified, benign |
| Rental/Fleet | #94A3B8 | Commercial vehicle |

### Harassment Tags
| Label | Color | Use |
|-------|-------|-----|
| Known Concern | #DC2626 | Identified harasser |
| Spam | #94A3B8 | Robocall, not targeted |
| Under Investigation | #D97706 | Being looked into |
| Cleared | #16A34A | Resolved |
| Reported to Authorities | #7C3AED | Escalated to LE |
| Unknown | #64748B | Not yet classified |

Tags render as small colored pills. On light backgrounds, the color is the text color with a 10% opacity background fill. On dark backgrounds, the color is used directly as text with a 15% opacity background.
