# Handoff: ISC SMS — Indigo Redesign + Login & Batch Detail

## Overview
This package contains a high-fidelity redesign of the **International Skills Club Student Management System (ISC SMS)**. It re-themes the app from signal-red to a deep **indigo** identity, ships a redesigned **Login** screen, and redesigns three **Batch Detail** tabs (Onboarding Analytics, Schedule, Assignments). It also includes Jira-grade builds of every other screen (Dashboard, All Students, Follow-Ups, Batches, Student Profile, Staff Tasks, Assessments, Concerns, Daily Reports, Lead Pipeline, Documents, Settings, Staff Management, Staff Requests, Trash).

Target codebase: **React 18 + Vite + Firebase** — the existing `isc-sms` repo (https://github.com/aDhiTthYAN/isc-sms). Routing is `react-router-dom`; icons are `lucide-react`.

## About the Design Files
The `*.dc.html` files in this bundle are **design references** — HTML prototypes that show the intended look, layout, copy, and interactions. They are **not** production code to paste in. The task is to **recreate these designs inside the existing React/Vite codebase** using its established patterns (components in `src/components`, pages in `src/pages`, `lucide-react` icons, the CSS-variable token system in `src/index.css`).

Every prototype uses inline styles that read from CSS custom properties (`var(--brand)`, `var(--surface)`, etc.). Those variables already exist in the repo's `src/index.css` — so the cleanest port is: **update the token values once**, and most of the re-theme lands automatically.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate pixel-for-pixel using the codebase's existing components and the token values below.

---

## 1. The new color system (do this first)

The whole app shifts to indigo by **overriding brand tokens**. Red is now reserved purely for danger/urgent; accent families (blue/green/amber/teal/violet/…) are unchanged, so colorful lozenges stay. Apply these to `:root` in `src/index.css` (replacing the old red `--brand*` values). They are also in `theme.css` in this bundle.

```css
:root {
  /* Brand → Indigo */
  --brand:        #4F46E5;
  --brand-600:    #4338CA;   /* hover   */
  --brand-700:    #3730A3;   /* pressed */
  --brand-100:    #E0E0FB;   /* soft wash */
  --brand-50:     #EEEDFE;   /* active nav pill / selected rows */
  --brand-ink:    #3A30C4;   /* text on brand-50 */

  --grad-brand:   linear-gradient(135deg, #8B83FF 0%, #4F46E5 55%, #3A30C4 100%);
  --shadow-brand: 0 8px 22px -8px rgba(79, 70, 229, .55);

  --canvas:         #F4F5FB;
  --surface-sunken: #EEEFF7;
  --surface-hover:  #F6F6FC;

  --grad-night:   linear-gradient(150deg, #2D2A55 0%, #1A1830 55%, #131124 100%);
  --grad-indigo:  linear-gradient(135deg, #8B83FF 0%, #4F46E5 50%, #3A30C4 100%);
  --grad-mesh:    radial-gradient(120% 120% at 10% 0%, #6D63F0 0%, #4F46E5 38%, #3A2FB8 70%, #2A2280 100%);
}
```

Anything hardcoded to the old red (e.g. `ProgressBar color="#E53935"`) should switch to `var(--brand)` so it tracks the theme. The ISC logo mark stays red (it's the brand asset) — see `assets/isc-mark.png`.

---

## 2. Login screen (`Login.dc.html` → `src/pages/Login.jsx`)

**Layout:** Full-viewport `--grad-mesh` indigo background with two floating radial blobs (9s/11s `floaty` keyframe, `translateY(0 → -14px)`) and a 26px dotted overlay at 50% opacity. Centered card, `max-width:880px`, `border-radius:24px`, `box-shadow:0 40px 90px -30px rgba(13,11,40,.8)`, split into a 2-column grid `1fr / 420px`.

- **Left rail** (`--grad-night`, white text, 42×40 padding): logo lockup (`assets/isc-mark.png` 42px, 11px radius + red glow shadow `0 8px 20px -6px rgba(232,22,32,.6)` + "International Skills Club" 15px/700 display). A status pill ("Student Management System · v3", green dot). Headline 27px/700 display, `letter-spacing:-.02em`: "Run your whole academy from one workspace." Sub 13px at 65% white. Bottom: 3 frosted stat tiles (`rgba(255,255,255,.07)` bg, `.12` border, 13px radius) — 248 Students · 12 Batches · 18 Staff.
- **Right form** (44×40 padding): amber "Authorised staff only" shield pill; "Welcome back" 26px/700 display heading; 13.5px muted sub. Email field + Password field (label row with "Forgot?" link). Inputs: 46px tall, 12px radius, 1px `--border`, focus = `--brand` border + `0 0 0 3px rgba(79,70,229,.16)` ring. Password has a show/hide eye toggle (eye / eye-off lucide icons). **Sign In** = 48px, 12px radius, `--grad-brand` bg, `--shadow-brand`, white 14.5px/600 + arrow-right icon, hover lifts 1px and deepens glow. Footer: lock icon + "Unauthorised access attempts are logged…" 11px muted, above a 1px top border.

**Behavior:** eye toggle flips password `type` between `password`/`text`. Sign In → navigate to `/dashboard`.

---

## 3. Batch Detail — redesigned tabs (`Batch Detail.dc.html` → `src/pages/BatchDetail.jsx`)

The page header (back button, batch title + status dropdown, `Other · 7 months · 1 Jun → 1 Jul · 16 students` meta, Course Flow / Student Fields / Delete buttons), the 5 KPI tiles, and the segmented tab bar are unchanged from the existing build. The contextual primary button changes per tab (Add Student / Add Class / Add Task / Add Assessment / Add Staff). Three tab bodies are redesigned:

### Onboarding Analytics — "funnel pipeline"
- **Hero row** (grid `1.4fr / 1fr`):
  - Left: `--grad-mesh` card, 18px radius, white text, with a radial highlight blob. Eyebrow "OVERALL ONBOARDING"; big number `overallPct%` (46px/700 display) beside "{fullyDone} of {totalStu} fully onboarded". Below: a **9-segment funnel bar** (one 8px/4px-radius segment per step; lit `rgba(255,255,255,.95)` if that step has any completion, else `rgba(255,255,255,.22)`). Caption "9 steps · {avgSteps} avg steps completed per student".
  - Right: two stacked stat cards — "Fully onboarded {n}/{total}" (green check-circle tile) and "Still in onboarding {n}" (amber clock tile).
- **Funnel list** (white card): heading "Onboarding funnel" + legend (Onboarding=brand dot, Course=teal dot). Steps grouped under phase headers (`ONBOARDING PHASE`, `COURSE PHASE`), each phase a vertical connector rail (2px `--border` line at `left:19px`, behind 30px node circles). Each step row: numbered node circle (filled `--brand`/white if done>0, else `--surface-sunken`/muted), step name 13.5px/600, a progress bar (max 320px) + `pct%`, a right cluster of `done/total`, a red "{n} pending" badge, and a "View ›" brand link. Row hover = `--surface-hover`.
- **Data:** `STEPS = [{name, phase:'Onboarding'|'Course', done, total:16}]` × 9. `pct = round(done/total*100)`; bar color = green ≥66, amber ≥33, brand >0, else `--n-300`. `overallPct` = mean of step pcts; `fullyDone` = last step's `done`; `avgSteps = (Σdone / 16).toFixed(1)`.

### Schedule — week timetable
White card, 16px radius. Toolbar: Week/Month segmented toggle, prev/next chevrons, "15 – 21 June 2026" label, Today ghost button; right side legend (teal "Live class", amber "Needs marking") + Share Schedule. Grid is `58px + repeat(7,1fr)`: a day-header row (weekday eyebrow + date circle, **today=21 circled in `--brand`/white**) over hourly rows (08:00–13:00). Each cell `min-height:56px`, 1px left border; **today's column tinted `rgba(79,70,229,.05)`**. The one class block (Sun 09:00) is an amber event card (`--amber-soft` bg, 3px `--amber` left bar) showing "English / 09:00–10:00 / Adhithyan · unmarked".

### Assignments — master/detail
Grid `340px / 1fr`.
- **Left:** two mini stat tiles (Assignments count; Fully done, green) + a selectable list of assignment cards. Each card: 13px radius, 3px left accent bar (green if done else `--brand`), title 13.5px/600, status badge (Done/Active), subject badge + "Due {date}", and a `submitted/total` progress bar. Selected card = `--brand` border + `--shadow-md`. Click selects.
- **Right (detail of selected):** title 19px/700; subject badge + owner (indigo badge) + due; a completion banner (green check-circle if 100%, else amber — text "{pct}% submitted" / "{n} students still pending"); 3 stat tiles (Submitted green / Pending amber / Total `--brand-50`); filter chips (Show All / Pending / Submitted) + student search; submission rows (avatar + name + phone + Submitted/Pending dot badge).
- **Data:** `ASSIGN = [{id,title,subject,subjectCls,owner,due,submitted,total}]`. Selecting sets `selAssign`. Submission rows derive status from `submitted/total` ratio.

---

## 4. Other screens
The remaining `*.dc.html` files are complete hi-fi references for their matching `src/pages/*`. They all share: a 230px sidebar (`Sidebar.dc.html` → `src/components/layout/Sidebar.jsx`), a 56px topbar, the token system, dot-status lozenges, and `lucide-react`-style icons. Notable interactive ones: **Staff Tasks Board** and **Lead Pipeline** are drag-and-drop kanbans (HTML5 drag events; on drop, update the item's column/stage in state → Firestore).

## Design Tokens
See `theme.css` (overrides) and the design system's full token set under `_ds/.../tokens/` in the design project. Radius ramp: chip 6 · sm 8 · button/input 10–12 · list 12–13 · card 16 · modal 20 · pill/avatar full. Shadows: the `--shadow-xs → xl` ramp. Type: **Space Grotesk** (display/numerals, 500–700, tracking -0.02em) + **DM Sans** (UI/body, 400–600), base 14px.

## Assets
- `assets/isc-mark.png` — the real red ISC logo mark (used on Login; keep red, don't recolor).
- Icons: `lucide-react` throughout. No bespoke SVG icons, no emoji.

## Files in this bundle
- `screenshots/` — rendered PNG of every screen (Login, Dashboard, All Students, Batch Detail, Batches, Student Profile, Follow-Ups, Staff Tasks Board, Lead Pipeline, Assessments, Concerns, Daily Reports, Documents, Settings, Staff Management, Staff Requests, Trash) — use these to verify your build matches the intended design.
- `theme.css` — the indigo token overrides (the heart of the re-theme).
- `Login.dc.html`, `Batch Detail.dc.html` — the priority redesigns.
- All other `*.dc.html` — reference for every screen.
- `Sidebar.dc.html` — shared nav, imported by every page.

---

## Suggested Claude Code workflow
1. Open the repo in Claude Code. Drop this folder in at the repo root (or point Claude at it).
2. Prompt: *"Read design_handoff/README.md. Start by updating the `:root` brand tokens in `src/index.css` to the indigo values in section 1 (and theme.css), then run the app so I can see the re-theme."*
3. Then, one screen at a time: *"Recreate the Login screen in `src/pages/Login.jsx` to match `Login.dc.html` and section 2 — use our existing components and lucide-react. Don't change routing/auth logic, only the UI."*
4. Repeat for Batch Detail tabs (section 3), then any other screens you want refreshed.
5. Keep each prompt scoped to one file/screen and ask Claude to preserve existing data fetching and Firebase calls — only swap the presentation.
