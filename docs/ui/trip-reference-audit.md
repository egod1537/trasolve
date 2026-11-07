# TRIP reference audit

## 1. Audit scope and fixed revisions

This document records code-level evidence for adapting TRIP's visual language
to Trasolve. It does not authorize copying TRIP's screen structure, behavior,
data model, Angular templates, or map implementation.

### Trasolve start snapshot

The following state was recorded before this audit. No checkout, reset, stash,
merge, or rebase was performed.

| Item                          | Recorded value                             |
| ----------------------------- | ------------------------------------------ |
| Repository                    | `https://github.com/egod1537/trasolve`     |
| Branch                        | `impl`                                     |
| HEAD                          | `f8ef4c799dfdda55fb0a35cd495504f451b89c67` |
| Upstream relation             | `impl...origin/impl [ahead 32]`            |
| Local `main...impl`           | `0 18` (0 behind, 18 ahead)                |
| Historical pre-style baseline | `46ba60903370ae59faef4633e2aba27eb810c7ca` |

The supplied earlier baseline (`fa9eb13d...`, 14 commits behind `main`) no
longer matched the checkout. The actual start HEAD already contained the prior
TRIP-style stages (`a764d81` through `f8ef4c7`). To avoid describing already
ported values as original Trasolve values, comparisons in this audit use the
historical pre-style commit `46ba609` through read-only `git show`/`git diff`.
The worktree was not switched to that commit.

The start worktree also contained unrelated in-progress changes. They were
preserved and excluded from this stage:

- `backend/src/index.ts`
- `backend/src/server.ts`
- `backend/src/trip-sharing/errors.ts`
- `backend/src/trip-sharing/tripShareController.ts`
- `backend/src/trip-sharing/tripShareHttpService.ts`
- `frontend/src/features/map-workspace/MapWorkspacePage.tsx`
- `frontend/src/features/map-workspace/index.ts`
- `frontend/src/features/map-workspace/model/mapWorkspaceMode.ts`
- `frontend/src/pages/share/PublicSharePage.tsx`
- `frontend/src/pages/share/public-share.css`
- `frontend/src/shared/api/tripSharing.ts`
- `frontend/src/shared/i18n/resources/{en,ja,ko,mn}/trip.json`
- `shared/constants/index.ts`
- `shared/index.ts`
- `shared/schemas/tripSharing.ts`
- `shared/types/tripSharing.ts`
- untracked `docs/trip-share-copy.md`

While the audit was in progress, those unrelated changes were committed in the
shared workspace as `52daa0c` (`feat(trip-sharing): copy shared trips to user
maps`). This audit did not stage or modify them. At document verification, the
only remaining worktree additions were the two files under `docs/ui/`.

### TRIP reference snapshot

TRIP was cloned outside the Trasolve repository at
`C:\Users\egod1\proj\trip-reference-audit`.

| Item                                | Recorded value                             |
| ----------------------------------- | ------------------------------------------ |
| Repository                          | `https://github.com/itskovacs/trip`        |
| Branch                              | `main`                                     |
| Commit                              | `856b1edfe81a735fce4b544c2e16a6518cebf164` |
| Tag at commit                       | `1.50.1`                                   |
| Commit date                         | `2026-10-02T14:43:16+02:00`                |
| Commit subject                      | `:bookmark: Version bump`                  |
| Clone state immediately after clone | `main...origin/main`, clean                |

All TRIP links below are pinned to this commit. The root tag is `1.50.1`, while
[`src/package.json`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/package.json)
still declares application package version `0.0.0`; the Git commit and tag are
therefore the reproducible reference, not that package field.

## 2. License and provenance

### TRIP repository license

TRIP's root
[`license.txt`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/license.txt)
contains the MIT License with `Copyright (c) 2026 Kovacs`. The license permits
use, copying, modification, merging, publication, distribution,
sublicensing, and sale, provided the copyright and permission notice are
included in copies or substantial portions. The full notice is already
preserved in Trasolve at `docs/licenses/TRIP-MIT.txt`.

No other repository-level `LICENSE`, `NOTICE`, or per-directory license file
was found. The reference contains PNG, WebP, and JPG application/documentation
assets, but no adjacent asset-specific license notice was found. The map code
does include OpenStreetMap attribution in
[`src/src/app/shared/map.ts`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/shared/map.ts#L43-L47).
Those images, map tiles, logos, screenshots, and favicon files are not migration
candidates.

### Locked third-party style sources

TRIP's declarations are resolved by `src/package-lock.json` to the versions
below. The Aura values in this audit were verified from the published
`@primeuix/themes@2.0.3` package source maps, not inferred from screenshots.

| Package                 | Locked version | License evidence                                                                                     | Use in this audit                                         |
| ----------------------- | -------------: | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `@primeuix/themes`      |        `2.0.3` | package `LICENSE`: MIT, Copyright 2025 PrimeTek                                                      | Aura primitive, semantic, and component token definitions |
| `primeng`               |       `21.1.1` | package `LICENSE.md`: community version MIT, Copyright 2016-2026 PrimeTek; `-lts` terms do not apply | Runtime component selection and defaults                  |
| `primeicons`            |        `7.0.0` | package metadata: MIT                                                                                | Identifies TRIP's icon family only                        |
| `tailwindcss`           |       `4.1.18` | package metadata: MIT                                                                                | Utility radius, type, spacing, and shadow values          |
| `tailwindcss-primeui`   |        `0.6.1` | package metadata: MIT                                                                                | Bridges PrimeNG tokens to utilities                       |
| `leaflet`               |        `1.9.4` | package metadata: BSD-2-Clause                                                                       | Map attribution/boundary context only                     |
| `leaflet-contextmenu`   |        `1.4.0` | package metadata: MIT                                                                                | Context-menu implementation context only                  |
| `leaflet.markercluster` |        `1.5.3` | package metadata: MIT                                                                                | Cluster implementation context only                       |

The inspected Aura package sources were:

- `package/dist/aura/base/index.mjs.map` →
  `src/presets/aura/base/index.ts`;
- `package/dist/aura/{button,inputtext,select,card,dialog,tooltip,menu,tag,badge,tabs}/index.mjs.map`
  → the corresponding `src/presets/aura/*/index.ts` files.

Migration policy: translate verified visual values into Trasolve semantic CSS.
Do not copy Angular/PrimeNG implementation code, Tailwind utility markup,
PrimeIcons glyphs, or TRIP assets. If a later stage directly copies a
substantial source fragment or asset, re-check that specific artifact's
license and retain its notice. Under the current plan, no third-party source
or asset is copied.

## 3. Actual TRIP styling stack and source locations

| Concern                  | Authoritative source                                                                                                                                                                                                                                                                                                                 | Finding                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Theme preset             | [`src/src/mytheme.ts`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/mytheme.ts)                                                                                                                                                                                                           | Aura preset with the entire primary scale redirected to Zinc and explicit light/dark primary/highlight states |
| Theme activation         | [`src/src/app/app.config.ts`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/app.config.ts#L21-L29)                                                                                                                                                                                     | PrimeNG uses `TripThemePreset`; dark selector is `.dark`                                                      |
| Utility layer            | [`src/src/tailwind.css`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/tailwind.css)                                                                                                                                                                                                       | Tailwind 4 plus `tailwindcss-primeui`; dark variant follows `.dark`                                           |
| Global and map overrides | [`src/src/styles.scss`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/styles.scss)                                                                                                                                                                                                         | Root type, Leaflet tooltip/menu/marker rules, overlay dialog, data-color mixes, and motion                    |
| Map workspace expression | [`dashboard.component.html`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/components/dashboard/dashboard.component.html) and [`trip.component.html`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/components/trip/trip.component.html) | Translucent controls, 8px radii, rings, blur, compact rows, `shadow-lg`/`shadow-2xl` floating surfaces        |
| Trip cards               | [`trips.component.html`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/components/trips/trips.component.html#L44-L114)                                                                                                                                                                 | Utility-built cards; no `p-card` use                                                                          |
| Place row                | [`place-list-item.component.html`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/shared/place-list-item/place-list-item.component.html)                                                                                                                                                | 12px-equivalent compact metadata, soft hover/border, 8px row radius, small chips                              |
| Detail content           | [`place-box-content.component.html`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/shared/place-box-content/place-box-content.component.html)                                                                                                                                          | Text icon actions, tooltip usage, compact links, popup menu appended to body                                  |
| Form expression          | [`auth.component.html`](https://github.com/itskovacs/trip/blob/856b1edfe81a735fce4b544c2e16a6518cebf164/src/src/app/components/auth/auth.component.html) and modal templates                                                                                                                                                         | PrimeNG input/select/textarea directives with Aura field tokens                                               |
| Icons                    | `styles.scss` PrimeIcons import and `pi pi-*` template classes                                                                                                                                                                                                                                                                       | PrimeIcons 7; no icon assets are to be copied                                                                 |

Fixed-string counts across TRIP's `src/src` at the pinned commit support the
dominant choices: `rounded-lg` 222, `rounded-md` 61, `rounded-xl` 27,
`rounded-2xl` 8, `text-xs` 400, `text-sm` 260, `font-medium` 244,
`font-semibold` 141, `duration-200` 35, and `duration-300` 29 occurrences.
Counts include HTML, TypeScript template strings, and SCSS and are evidence of
relative use, not a component API.

## 4. Code-derived tokens

### 4.1 Primary palette

`mytheme.ts` maps `primary.50..950` to Aura's Zinc primitives. The exact
values in `@primeuix/themes@2.0.3` are:

| Step | Value     | Step | Value     |
| ---: | --------- | ---: | --------- |
|   50 | `#fafafa` |  500 | `#71717a` |
|  100 | `#f4f4f5` |  600 | `#52525b` |
|  200 | `#e4e4e7` |  700 | `#3f3f46` |
|  300 | `#d4d4d8` |  800 | `#27272a` |
|  400 | `#a1a1aa` |  900 | `#18181b` |
|      |           |  950 | `#09090b` |

### 4.2 Light/dark semantics

There are two simultaneous surface channels in TRIP and they must not be
collapsed during provenance analysis:

1. Tailwind/PrimeUI `primary-*` utilities resolve to Zinc because of
   `TripThemePreset`. Large application surfaces such as `bg-primary-50` and
   `dark:bg-primary-900` are therefore Zinc.
2. Unoverridden Aura `surface.*` tokens remain Slate in light mode and Zinc in
   dark mode. PrimeNG fields, content, and overlays consume those surface
   tokens unless templates override them with utilities.

| Role                       | Light                | Dark                        | Source       |
| -------------------------- | -------------------- | --------------------------- | ------------ |
| TRIP primary               | `#09090b` (Zinc 950) | `#fafafa` (Zinc 50)         | `mytheme.ts` |
| Primary hover              | `#18181b` (Zinc 900) | `#f4f4f5` (Zinc 100)        | `mytheme.ts` |
| Primary active             | `#27272a` (Zinc 800) | `#e4e4e7` (Zinc 200)        | `mytheme.ts` |
| Declared primary inverse   | `#ffffff`            | `#09090b`                   | `mytheme.ts` |
| Highlight background       | `#09090b`            | `rgba(250, 250, 250, 0.16)` | `mytheme.ts` |
| Highlight focus background | `#3f3f46`            | `rgba(250, 250, 250, 0.24)` | `mytheme.ts` |
| Highlight text             | `#ffffff`            | `rgba(255, 255, 255, 0.87)` | `mytheme.ts` |
| Aura surface 50            | Slate 50 `#f8fafc`   | Zinc 50 `#fafafa`           | Aura base    |
| Aura surface 100           | Slate 100 `#f1f5f9`  | Zinc 100 `#f4f4f5`          | Aura base    |
| Aura surface 200           | Slate 200 `#e2e8f0`  | Zinc 200 `#e4e4e7`          | Aura base    |
| Aura surface 700           | Slate 700 `#334155`  | Zinc 700 `#3f3f46`          | Aura base    |
| Aura surface 800           | Slate 800 `#1e293b`  | Zinc 800 `#27272a`          | Aura base    |
| Aura surface 900           | Slate 900 `#0f172a`  | Zinc 900 `#18181b`          | Aura base    |
| Aura surface 950           | Slate 950 `#020617`  | Zinc 950 `#09090b`          | Aura base    |
| Modal mask                 | `rgba(0,0,0,0.4)`    | `rgba(0,0,0,0.6)`           | Aura base    |

Aura light fields use white background, Slate 300 border, Slate 400 hover
border, Slate 700 text, Slate 500 placeholder/disabled text, and primary focus
border. Dark fields use Zinc 950 background, Zinc 600 border, Zinc 500 hover
border, white text, Zinc 400 placeholder/disabled text, and primary focus
border. Invalid borders are Red 400 in light and Red 300 in dark.

Explicit application states also use Tailwind Blue, Emerald/Green, Red,
Orange, and Amber utilities. These remain semantic/data states; they do not
replace the neutral primary system.

### 4.3 Typography and spacing

`styles.scss` sets the root to 15px, `line-height: normal`, and the following
family without bundling a font file:

`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, ...emoji fallbacks`

Tailwind 4.1.18 defines the values below. Because TRIP changes the root to
15px, the effective pixel values differ from the usual 16px-root examples.

| Utility token   |                      Source value | Effective at TRIP root |
| --------------- | --------------------------------: | ---------------------: |
| `text-xs`       |     `0.75rem`, line-height `1rem` |       `11.25px / 15px` |
| `text-sm`       | `0.875rem`, line-height `1.25rem` |   `13.125px / 18.75px` |
| `text-base`     |      `1rem`, line-height `1.5rem` |        `15px / 22.5px` |
| `text-lg`       | `1.125rem`, line-height `1.75rem` |   `16.875px / 26.25px` |
| `font-medium`   |                             `500` |                  `500` |
| `font-semibold` |                             `600` |                  `600` |
| `font-bold`     |                             `700` |                  `700` |
| spacing unit    |                         `0.25rem` |               `3.75px` |

Common template spacing (`p-2`, `p-3`, `p-4`, `gap-2`, `gap-3`) therefore
forms a roughly 7.5/11.25/15px rhythm. Trasolve can map this to its existing
8/12/16px semantic spaces to avoid fractional layout changes; that mapping is
an adaptation, not a claim that TRIP declares integer pixel spacing.

### 4.4 Radius, shadow, motion, focus, and disabled state

Aura primitive radii are `0`, `2px`, `4px`, `6px`, `8px`, and `12px` for
`none` through `xl`. Tailwind's used radii are `4px` (`rounded-sm`), `6px`
(`rounded-md`), `8px` (`rounded-lg`), `12px` (`rounded-xl`), and `16px`
(`rounded-2xl`). `rounded-lg` is the dominant application radius.

| Token/style                                     | Exact value                                                       | Observed use                  |
| ----------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- |
| Tailwind/Aura card `shadow-sm`                  | `0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`       | cards and low elevation       |
| Tailwind `shadow-md` / Aura select-popover-menu | `0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)`    | popup overlays                |
| Tailwind `shadow-lg`                            | `0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)`  | compact floating map controls |
| Tailwind `shadow-xl` / Aura modal               | `0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)` | modal elevation               |
| Tailwind `shadow-2xl`                           | `0 25px 50px -12px rgba(0,0,0,.25)`                               | large floating map panels     |
| Leaflet custom tooltip                          | `0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06)`             | `.class-tooltip`              |
| Leaflet context menu                            | `0 10px 20px rgba(64,64,64,.15)`                                  | `.leaflet-contextmenu`        |
| Default transition                              | `0.2s`                                                            | Aura semantic token           |
| Modal mask transition                           | `0.3s`                                                            | Aura semantic token           |
| Global focus ring                               | `1px solid {primary.color}`, offset `2px`, no shadow              | Aura semantic token           |
| Form-field focus ring                           | width `0`, style `none`; focus is carried by border color         | Aura semantic token           |
| Disabled opacity                                | `0.6`                                                             | Aura semantic token           |

Actual templates also use `duration-150`, `duration-200`, and `duration-300`
and occasional `active:scale-[0.98]`. Movement is not a universal component
rule; it is applied only where the template declares it.

### 4.5 Core component definitions and actual use

| Component      | Verified expression                                                                                                                                      | Actual TRIP use and migration decision                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button         | 6px field radius, 8px gap, 500 label weight, default padding `0.75rem × 0.5rem`, icon-only width `2.5rem`; neutral primary states come from `mytheme.ts` | `p-button` is widespread, often `text`, `secondary`, or semantic severity. Map to Trasolve `Button`/`IconButton`; do not import PrimeNG.                               |
| Input/textarea | White/Slate light and Zinc 950/600 dark field scheme; 6px radius; `0.75rem × 0.5rem`; focus border instead of inner ring                                 | `pInputText`/`pTextarea` are widespread. Trasolve has no shared Input component, so apply tokens to existing feature selectors without changing dimensions or fields.  |
| Select         | Same field root; 2.5rem dropdown area; overlay 6px radius, `shadow-md`; list padding 0.25rem, 2px gap, option `0.5rem 0.75rem`, 4px radius               | `p-select` is used in dashboard and modals. Preserve native/current selection behavior; style existing selects only.                                                   |
| Card           | Aura default: 12px radius, `shadow-sm`, 1.25rem body padding, 1.25rem/500 title                                                                          | No `<p-card>` use was found. TRIP's visible cards are mainly utility-built 8px/12px bordered surfaces. Prefer those observed templates over unused Aura card defaults. |
| Dialog/modal   | 12px radius, `shadow-xl`, 1.25rem padding, 1.25rem/600 title; mask 40%/60%                                                                               | `p-dialog` plus several manual overlays. Map only appearance to Trasolve `Dialog`; preserve body portal, focus trap, Escape/backdrop rules, and scroll locking.        |
| Tooltip        | max width 12.5rem, 0.5rem/0.75rem padding, 6px radius, popover shadow, surface 700 background and white text                                             | `pTooltip` is widespread; Leaflet additionally has the fixed 200px custom tooltip. Keep Trasolve semantics/ARIA and adapt appearance.                                  |
| List item      | Transparent border at rest, `primary-50`/`primary-800` hover, `primary-200`/`primary-700` hover border, 8px radius, 12px-equivalent padding              | Directly relevant to Trasolve layer/place rows. Do not change order, click/DnD targets, or row height.                                                                 |
| Badge/tag      | Aura Tag: 0.875rem/700, 0.25rem 0.5rem, 6px radius; Aura Badge: 0.75rem/700, 6px radius, min 1.5rem. Soft semantic backgrounds.                          | No `<p-tag>` or `<p-badge>` use was found. Actual chips are utility spans, often 4/8px or pill radius. Port compact soft-state expression, not unused component code.  |
| Tabs           | 1px bottom border and active bar, transparent backgrounds, muted → text → primary states, `1rem 1.125rem` padding, 600 weight                            | `<p-tabs>` is used in trip/dashboard/modals. Trasolve should keep existing tab structure and only port border/color/weight.                                            |
| Menu           | Content surface/border, 6px radius, `shadow-md`; list 0.25rem with 2px gaps; items `0.5rem 0.75rem`, 4px radius                                          | Popup `p-menu` instances use `appendTo="body"`. This is direct evidence that portal layering and root theme tokens must be verified.                                   |
| Icon           | PrimeIcons 7 classes, generally 12-18px in compact controls                                                                                              | Keep Trasolve inline SVGs and Blueprint icons in scoped testbeds. Copying PrimeIcons would add a library and create unnecessary license/visual churn.                  |

## 5. Trasolve current-state audit

### Stack and theme boundary

- React 19 + TypeScript + Vite; plain imported CSS and CSS custom properties.
- No Tailwind, PrimeNG, Sass, CSS-in-JS, or general component framework in the
  main UI.
- `@blueprintjs/core` 6.18 and `@blueprintjs/icons` 6.13 are present, but use is
  concentrated in troute/tcache testbeds and their job-builder UI. Blueprint
  CSS is imported locally by those testbed roots; it is not the Trasolve
  design-system base.
- `frontend/src/shared/ui` provides Button, IconButton, Dialog, Panel,
  EmptyState, StatusBadge, Progress, Tooltip, DragHandle, and inline SVG icons.
  There is no shared Input, Select, Card, Tab, or Menu component.
- `ThemeProvider` resolves `light | dark | system`, stores the preference, and
  writes `data-theme` plus `color-scheme` to the root element. The selector
  must remain `[data-theme='light'|'dark']`; adopting TRIP's `.dark` runtime
  contract would be functional churn.

The pre-style baseline used Slate/Blue light semantics and navy/Blue dark
semantics. At the audit HEAD, `theme.css` already contains the previously
ported Zinc/neutral primary values, 15px Inter-first typography, and TRIP-like
shadows. This stage does not reapply or modify them.

### Current z-index and portal system

| Layer              | Current value / location                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Dropdown token     | `--z-dropdown: 1000`                                                                        |
| Map overlay token  | `--z-map-overlay: 2000`                                                                     |
| Map-local overlays | approximately 1900, 2000, 2100, 2200, 3000, 3100, 3200, 4000, and 5000 depending on feature |
| Dialog token       | `--z-dialog: 10000`                                                                         |
| Tooltip token      | `--z-tooltip: 11000`                                                                        |
| Shared Dialog      | portals to `document.body` by default                                                       |
| Feature popovers   | several use `createPortal(..., document.body)` and viewport-position calculations           |

`--shadow-map-overlay` is the required local invariant for map floating
surfaces. Stage 2 removed the separate `--shadow-map-overlay-menu` path: the
map profile menu now consumes `--shadow-map-overlay`, while the non-map theme
menu consumes the general `--shadow-popup` role. Marker halos, selection rings,
timeline handles, and focus rings are state shadows and remain outside that
surface rule.

## 6. Source-to-Trasolve mapping

| TRIP source/declaration           | Extracted value/expression                                     | Trasolve target                                                   | Adaptation method                                                                            | Potential conflict                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mytheme.ts` Zinc primary         | Zinc 50-950; near-black light action, near-white dark action   | `frontend/src/app/styles/theme.css` accent, text, surface aliases | Preserve semantic token names; no Tailwind classes                                           | Current main surfaces intentionally use Zinc rather than Aura's light Slate channel                                                        |
| Aura light/dark surface scheme    | Slate light, Zinc dark for PrimeNG internals                   | surface/border/text tokens                                        | Use code evidence per role, not a blanket palette copy                                       | Mixing Slate and Zinc without role labels creates subtle mismatches                                                                        |
| `styles.scss` root type           | 15px, Inter-first, normal line height                          | `global.css`                                                      | Root declaration only                                                                        | Font availability differs; no font asset may be added implicitly                                                                           |
| Tailwind spacing                  | 0.25rem unit at 15px root                                      | `--space-*`                                                       | Map to existing 4/8/12/16/20/24/32px tokens                                                  | Exact fractional values would alter layout and hit geometry                                                                                |
| Aura + Tailwind radii             | 2/4/6/8/12/16px; 8px dominant                                  | `--radius-*`                                                      | Keep semantic scale; apply by component role                                                 | Pill status and circular controls must not be flattened                                                                                    |
| Tailwind/Aura shadows             | `shadow-sm/md/lg/xl/2xl` table above                           | `--shadow-*`, `--shadow-dialog`, `--shadow-map-overlay`           | Map elevation by surface role                                                                | TRIP uses both lg and 2xl on map; Trasolve requires one map surface token, so use a documented compromise rather than per-selector shadows |
| Aura focus/disabled               | 1px primary ring offset 2; field focus border; opacity .6      | global focus, field selectors, primitives                         | Preserve visible keyboard affordance; adopt exact opacity only after contrast/behavior check | Trasolve currently uses a more visible 2px blue focus ring and .55 button opacity                                                          |
| Aura button + actual text buttons | neutral filled primary, bordered secondary, ghost icon actions | `Button`, `IconButton`, `primitives.css`                          | CSS-only styling                                                                             | Padding/height changes can alter toolbars and panel widths                                                                                 |
| Aura fields/selects               | 6px radius, compact padding, subtle border, popup list rhythm  | local field/select CSS                                            | Tokenize existing selectors; no new form API                                                 | Native select arrow, validation, and measured forms differ from PrimeNG                                                                    |
| Utility-built cards/lists         | 8-12px radius, subtle border, soft hover, `shadow-sm`          | Panel, trip cards, layer/place rows                               | Style existing classes                                                                       | DnD row bounds and double-click targets must remain identical                                                                              |
| PrimeNG dialogs/menus/tooltips    | portal overlays with modal/popover shadows                     | shared Dialog/Tooltip and existing feature portals                | Appearance only                                                                              | Portal loses feature-scoped selectors; z-index and root theme variables must remain available                                              |
| Map translucent surfaces          | white/Zinc at ~70-80%, blur-xl/2xl, low-opacity ring           | map overlay selectors                                             | Use map material tokens and the single map shadow token                                      | `backdrop-filter` creates stacking contexts and may reduce map performance                                                                 |
| PrimeIcons                        | `pi pi-*` icon font                                            | existing inline SVGs; Blueprint only in testbeds                  | Do not migrate                                                                               | Adding the icon package violates the minimal-dependency goal                                                                               |

## 7. Risk classification and immutable boundaries

### P0: functional/layout risk

- Do not change `.trip-map-workspace` grid columns, the 468px desktop panel,
  the 320px intermediate panel, the 760px mobile collapse, map height/width,
  panel visibility, or responsive positioning.
- Do not change Google Map container ancestry, overflow, transforms, or the
  `MapRuntime`/adapter boundary. A new transform or stacking context can
  affect map controls, marker overlays, and viewport calculations even when
  it looks purely visual.
- Do not change portal targets, focus trapping, Escape/backdrop behavior,
  body scroll locking, or overlay coordinate calculations.
- Do not change DnD handle dimensions, pointer capture, row geometry,
  double-click targets, touch actions, or state classes. Style selectors must
  not absorb events or move the hit target.
- Do not change z-index relationships without testing body portals against
  map-local overlays and dialogs.

### P1: visual/accessibility risk

- Neutral primary focus colors can be hard to distinguish on Zinc surfaces;
  retain a clearly visible focus indication until both themes are verified.
- Translucency/blur over live map imagery changes contrast continuously.
  Validate text, muted text, borders, disabled controls, and status colors on
  varied map areas.
- Dynamic day/place/category colors are data, not theme accents. Preserve
  their values and use low-opacity mixes only for supporting surfaces.
- Global radius or line-height changes can move dense controls enough to
  trigger wrapping, clipping, or portal repositioning.

### P2: scope/licensing risk

- Do not introduce Angular, PrimeNG, Tailwind, PrimeIcons, or a new large UI
  library. Their values are reference evidence, not dependencies.
- Do not copy TRIP screenshots, cover image, logo, favicons, map tiles, or
  documentation assets.
- Keep Blueprint overrides scoped to existing testbeds; do not make them the
  general visual layer.

## 8. Token candidates for later stages

These candidates are sourced values or explicit adaptations. They are not UI
changes in this stage.

| Candidate family | Candidate                                                                                      | Evidence / decision status                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Neutral primary  | Zinc 50-950 table above                                                                        | Exact TRIP declaration; approved reference                                                          |
| Semantic action  | light `#09090b/#18181b/#27272a`; dark `#fafafa/#f4f4f5/#e4e4e7`                                | Exact TRIP primary/hover/active                                                                     |
| Canvas/surface   | Zinc 50/white light; Zinc 950/900 dark                                                         | Actual utility-built screens; do not mislabel as Aura's light surface default                       |
| State colors     | Blue info/focus, Red danger, Emerald/Green success, Amber warning                              | Actual explicit utilities and Aura primitives; select per existing semantic role                    |
| Space            | existing 4/8/12/16/20/24/32px                                                                  | Deliberate rounded adaptation of TRIP's 3.75px base to preserve layout                              |
| Radius           | 4/6/8/12/16px plus pill                                                                        | Exact Tailwind values used by TRIP; 2px Aura radius remains available only if a real target appears |
| Card shadow      | `shadow-sm` exact value                                                                        | Exact Tailwind/Aura card value                                                                      |
| Popup shadow     | `shadow-md` exact value                                                                        | Exact Aura select/popover/navigation value                                                          |
| Dialog shadow    | `shadow-xl` exact value                                                                        | Exact Aura modal value                                                                              |
| Map shadow       | one global `--shadow-map-overlay`; evaluate `shadow-lg` compromise against TRIP's lg/2xl split | Local repository invariant prevents literal dual shadows                                            |
| Motion           | 120-200ms color/opacity; up to 300ms overlay transitions                                       | 200/300ms are exact source values; 120ms is existing Trasolve fast feedback                         |
| Disabled         | opacity `0.6` candidate                                                                        | Exact Aura value; verify contrast and progress/loading exceptions                                   |

No value outside these sourced tables should be promoted to a design token
without another code or rendered-UI observation. The implementation order and
verification gates are recorded in `docs/ui/trip-style-migration-plan.md`.

## 9. Stage 2 realized token mapping

The implementation keeps the existing `--color-*`, `--bg-*`, `--text-*`, and
`--border-*` compatibility layers. The new role tokens below are the single
entry points for later component work.

| Token family                        | Implementation                                                                                                        | Provenance classification                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Background/surface/elevated/overlay | `--color-bg`, `--color-surface`, `--color-surface-elevated`, `--color-surface-overlay`, `--color-overlay-backdrop`    | Zinc application surfaces are TRIP-derived; backdrop opacity is a Trasolve live-map extension                  |
| Text hierarchy                      | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-placeholder`                         | Zinc hierarchy from TRIP utilities; placeholder uses Aura's exact light Slate 500/dark Zinc 400 field role     |
| Border hierarchy                    | `--color-border`, `--color-border-strong`, `--color-hover-border`, `--color-disabled-border`                          | Base Zinc boundaries from TRIP application use; disabled boundary uses Aura field roles                        |
| Accent and selection                | `--color-accent`, `--color-accent-hover`, `--color-selected-bg`, `--color-selected-hover-bg`, `--color-selected-text` | Exact `mytheme.ts` primary and highlight declarations                                                          |
| Focus                               | `--color-focus-ring`, `--focus-ring-width`, `--focus-ring-offset`                                                     | Blue 2px ring is an explicit Trasolve accessibility extension; TRIP's source ring is neutral 1px               |
| Hover/active/disabled               | `--color-hover-bg`, `--color-active-bg`, `--color-disabled-*`, `--opacity-disabled`                                   | Hover/active use the TRIP Zinc surface hierarchy; disabled colors/0.6 opacity come from Aura                   |
| Semantic states                     | `--color-info-*`, `--color-success-*`, `--color-warning-*`, `--color-danger-*`                                        | Tailwind/Aura state scales observed in TRIP; role assignment remains Trasolve semantic behavior                |
| Map overlay                         | `--color-map-overlay-*`, `--map-overlay-blur`, `--shadow-map-overlay`                                                 | TRIP translucent/ring/blur expression adapted to one required Trasolve map-surface shadow                      |
| Typography                          | `--font-family-sans`, `--font-size-*`, `--font-weight-*`, `--line-height-*`                                           | TRIP 15px root and Tailwind 4.1.18 type scale; Pretendard fallback is a Trasolve localization extension        |
| Radius/spacing                      | `--radius-*`, `--space-*`                                                                                             | TRIP's used Tailwind radii; spacing is the documented integer rounding of the 3.75px source unit               |
| Elevation                           | `--shadow-card`, `--shadow-popup`, `--shadow-dialog`, `--shadow-map-overlay`                                          | Tailwind/Aura `sm`, `md`, `xl`, and TRIP map `lg` geometry; dark opacity is a Trasolve contrast extension      |
| Scrollbar                           | `--color-scrollbar-*`                                                                                                 | Trasolve extension because TRIP has no explicit scrollbar tokens; only app-owned scroll areas may consume them |

Global state selectors are scoped through `#root` and `.ui-dialog`, and exclude
Google Maps `.gm-style` descendants and Blueprint `bp6-*` controls. This keeps
the application's placeholder, selection, focus, native checkbox/radio, and
disabled defaults consistent without overriding SDK or Blueprint internals.

## 10. Stage 3 shared-element realization

Stage 3 re-expresses the pinned TRIP/Aura values through Trasolve's existing
components and CSS boundaries. No PrimeNG runtime, PrimeIcons asset, copied
component implementation, or new user route is introduced.

| Trasolve boundary                           | Applied TRIP evidence                                                                                                                       | Preserved contract                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `IconButton`                     | Aura button 6px field radius, 500 label weight, 8px gap, neutral primary states, filled Red destructive states, and 32px compact icon width | public variants/sizes, 32px and 38px targets, loading/disabled behavior, native click/submit semantics, accessible icon label |
| `.ui-field` / `.ui-select` / `.ui-textarea` | Aura field surface, 6px radius, subtle boundary, hover/focus/invalid/disabled roles; current 38px Trasolve height and padding are retained  | native input/select/textarea behavior, values, validation, and measured height                                                |
| `Panel`                                     | observed TRIP utility cards' 8px neutral boundary and exact `shadow-sm` geometry via `--shadow-card`                                        | section semantics, padding ownership, content order                                                                           |
| `Dialog`                                    | Aura 12px modal radius, mask, and `shadow-xl` role already provided by Stage 2                                                              | body portal, focus trap/restore, Escape/backdrop rules, scroll locking                                                        |
| `Tooltip`                                   | 6px radius, compact padding, neutral inverse surface, `shadow-md`; Trasolve's 240px translated-content maximum remains                      | `aria-describedby`, hover/focus reveal, pointer behavior                                                                      |
| `StatusBadge`                               | compact 6px soft semantic tag expression with 12px/600 local typography                                                                     | tone meaning, text, inline layout                                                                                             |
| `Progress` / `EmptyState` / spinner         | neutral track and muted hierarchy; spinner now inherits the owning control's contrast color                                                 | progress ARIA, determinate/indeterminate math, reduced motion, loading disable behavior                                       |
| Language/theme controls                     | form-field radius and disabled opacity; Aura navigation spacing and selected/focus states                                                   | theme/language storage, menu roles, keyboard/outside-click behavior                                                           |
| Existing share toggle                       | semantic disabled surface and the shared accessible focus ring                                                                              | checkbox state, label target, submit/update handlers                                                                          |

The existing `/testbed/localization` route is the Stage 3 comparison surface:
it now consumes the reusable field/select hooks in addition to its existing
`Panel` and `StatusBadge` instances. Tabs, toast, and a generic menu/popover are
not present as shared Trasolve APIs, so no unused abstraction was added merely
to mirror PrimeNG. Blueprint controls remain scoped to their existing testbeds.

Only design values and state expressions were transposed. No TRIP source file,
icon, font, image, or other asset was copied, so the Stage 1 license notice and
source attribution remain sufficient for this implementation.

## 11. Stage 4 map-workspace realization

Stage 4 applies the audited map expression through the Stage 2 semantic tokens
without changing React structure, handlers, map adapters, data, or responsive
rules. The existing inline SVGs and Google Maps implementation remain intact.

| Trasolve boundary                           | Applied source-backed expression                                                                                                                                       | Preserved boundary                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map-workspace/styles/map.css`              | TRIP's 70-80% white/Zinc map material, 8px dominant radius, low-opacity ring, `shadow-lg`-mapped `--shadow-map-overlay`, compact ghost actions, and neutral row states | 468px/320px/mobile panel geometry, scroll regions, DnD transforms and handles, route/place data colors, overlay coordinates, z-index, and pointer events |
| `quick-search.css`                          | translucent 8px command surface, compact 6px controls, neutral hover, shared map ring/blur/shadow                                                                      | input grid, keyboard handlers, result bounds, focus ownership, and portal lifetime                                                                       |
| `bottom-context-panel.css`                  | shared 8px floating material plus Blue/info, Emerald/success, and Red/danger job-status hierarchy                                                                      | floating-bar dimensions, route optimizer fields, SSE/progress structure, nested dialog and map bounds                                                    |
| `trip-maps.css`                             | audited 8px card/control radius through `--radius-md` and existing map material tokens                                                                                 | picker dialog dimensions, preview bounds, navigation, create/open/delete handlers                                                                        |
| `place-info-card.css` and `map-toolbar.css` | shared 8px map cards, transparent list rows over the material, and the documented accessible Blue focus ring                                                           | card anchoring, search measurements, form values, marker selection, and add/edit/delete behavior                                                         |
| `map-user-controls.css`                     | neutral filled primary profile control, 8px translucent menu, 6px menu rows, single map shadow                                                                         | auth status, menu roles, outside-click/Escape behavior, navigation, account actions                                                                      |
| `anchored-map-card.css`                     | already used the audited map surface/ring pointer treatment; no edit required                                                                                          | anchor transform and pointer geometry                                                                                                                    |

The main sidebar was the concrete remaining inconsistency: it used the opaque
compatibility surface while the surrounding toolbar, bottom controls, and
popovers already consumed the map material tokens. It now uses
`--color-map-overlay-surface`, `--color-map-overlay-ring`,
`--map-overlay-blur`, and `--shadow-map-overlay`. Blur is applied only to the
floating sidebar itself, not to `.trip-map-root`, `.trip-map-canvas`,
`.map-viewport`, or Google Maps descendants.

The route status classes now assign existing semantic roles to `running`,
`completed`, `failed`, and input-blocked states. No state name, formatter,
message, transition, or job behavior changed. Remaining marker halos, DnD
shadows, timeline handles, and progress-step rings are state indicators rather
than floating surfaces and intentionally retain their local shadows.

No TRIP source file, component implementation, icon, image, font, or asset was
copied in Stage 4. The implementation is a token mapping only, so the Stage 1
MIT attribution and source links remain the complete provenance record.

## 12. Stage 6 final provenance and license verification

The final regression pass rechecked the reference checkout rather than relying
only on the Stage 1 notes:

| Item                    | Verified value                                         |
| ----------------------- | ------------------------------------------------------ |
| Reference remote        | `https://github.com/itskovacs/trip.git`                |
| Pinned reference commit | `856b1edfe81a735fce4b544c2e16a6518cebf164`             |
| Upstream license source | `C:/Users/egod1/proj/trip-reference-audit/license.txt` |
| Preserved notice        | `docs/licenses/TRIP-MIT.txt`                           |
| Copyright line          | `Copyright (c) 2026 Kovacs`                            |
| License                 | MIT License                                            |

The upstream checkout contains one repository-level `license.txt`. Package
archives inspected during the audit keep their own package notices under the
external checkout's untracked `.audit-packages/` directory; none of those
packages or files was added to Trasolve. The preserved TRIP notice matches the
upstream text after removing only the optional final line feed. The local copy
intentionally ends with LF to satisfy the repository text-file policy.

The design migration commit range is `2cb68f5..ef37a50`. Its only added binary
files are the six before/after PNG captures of Trasolve itself under
`docs/ui/screenshots/`. No TRIP screenshot, logo, icon, font, image, Angular
component, PrimeNG component, Tailwind stylesheet, or source module was copied
or modified for use in Trasolve. The implementation is a clean semantic-token
and CSS re-expression based on the declarations cited in this audit.

Accordingly, the provenance classification remains:

- **Copied or modified TRIP code/assets:** none.
- **Source-informed reimplementation:** palette roles, radii, type scale,
  elevation, and interaction-state expressions mapped through Trasolve's own
  tokens and selectors.
- **Required preserved attribution:** the pinned repository URL/commit and the
  complete MIT notice in `docs/licenses/TRIP-MIT.txt`.

The unrelated concurrent commit `5649002` changes a Trasolve memo click
handler and is outside this design/license range.
