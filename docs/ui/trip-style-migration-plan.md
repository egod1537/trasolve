# TRIP style migration plan

## 1. Purpose and current status

This is a visual-language migration plan, not a screen redesign. Trasolve's
layout, information architecture, features, routes, state, persistence,
Google Maps integration, keyboard/mouse/touch behavior, drag-and-drop, and
mobile behavior remain authoritative.

The audit began at `impl` HEAD
`f8ef4c799dfdda55fb0a35cd495504f451b89c67`. That revision already contains a
previous TRIP-style implementation sequence:

| Existing commit | Recorded stage                      |
| --------------- | ----------------------------------- |
| `a764d81`       | source analysis and MIT notice      |
| `bbd2326`       | design tokens and global styles     |
| `61a262d`       | shared UI primitives                |
| `ffed5c7`       | map workspace appearance            |
| `b0b14aa`       | remaining screens and theme cleanup |
| `f8ef4c7`       | verification record                 |

Therefore this plan has two uses:

1. it records the source-driven order that should be used from the historical
   pre-style baseline `46ba609` or an equivalent branch; and
2. on the current branch, it is a reconciliation checklist. Do not replay the
   old commits or rewrite already-correct CSS. Only fix a documented gap after
   checking the current diff and rendered UI.

The authoritative token evidence, license analysis, component findings, and
risks are in `docs/ui/trip-reference-audit.md`.

## 2. Non-negotiable guardrails

- Keep `.trip-map-workspace` at the existing 468px desktop panel width, 320px
  intermediate width, and current mobile collapse/breakpoints.
- Keep the map viewport size, left/right placement, panel visibility, and
  responsive rules unchanged.
- Keep place/layer information order, fields, URL/navigation structure, and
  all user-visible functionality unchanged.
- Do not modify `MapRuntime`, Google Maps adapters, `TripStore`,
  `TripEditController`, persistence, authentication, troute/SSE, AI, API/data
  contracts, backend, database, or deployment.
- Do not change event handlers, portal targets, focus management, keyboard
  shortcuts, pointer capture, DnD geometry, double-click behavior, or touch
  behavior.
- Do not add Angular, PrimeNG, Tailwind, PrimeIcons, or another large UI
  library. Use Trasolve's existing semantic tokens and CSS.
- Every map floating surface uses `--shadow-map-overlay`. Marker halos,
  selection rings, focus rings, drag/timeline handles, and similar state
  indicators are not surface shadows.
- No new user-facing text is expected. If implementation unexpectedly needs
  text, follow the localization workflow rather than hardcoding it.
- Do not add automated test files, fixtures, mock SDKs, or test-only branches.

## 3. Priority model

| Priority | Meaning                                              | Gate                                                                                 |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P0       | Prevent functional/layout regression                 | No visual change proceeds if map, portal, DnD, focus, or responsive geometry changes |
| P1       | Establish shared visual language                     | Tokens and shared elements must settle before feature selectors                      |
| P2       | Apply the language to the map workspace              | CSS-only, preserving overlay and interaction boundaries                              |
| P3       | Align remaining screens and scoped third-party areas | No framework-wide override or feature refactor                                       |
| P4       | Verify, document, and remove inconsistencies         | All checks and real UI review must pass                                              |

## 4. Target visual examples

These examples describe appearance only; they are not instructions to change
content or layout.

| Current/pre-style expression         | Target expression                                                                           | Source basis                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Blue primary CTA                     | Zinc 950 fill with white text in light; Zinc 50 with Zinc 950 text in dark                  | `mytheme.ts` primary states                         |
| Navy dark canvas and raised surfaces | Zinc 950 canvas, Zinc 900 raised surface, Zinc 800 hover                                    | TRIP utility surfaces and dark Aura surface scale   |
| Strong blue selection fill           | Neutral highlight for general selection; Blue retained for informational/map-specific state | `mytheme.ts` highlight plus explicit Blue utilities |
| Heavy blue-gray card boundary        | Zinc 200/700 one-pixel border with `shadow-sm` only when elevation is needed                | trip/list templates and Tailwind shadow             |
| Opaque map panel                     | 70-80% white/Zinc surface, low-opacity ring, backdrop blur, global map overlay shadow       | dashboard/trip floating panels                      |
| Pill used for every status           | Compact 4-8px rounded soft-state chip; pill only where count/category semantics call for it | actual utility spans; no `p-tag`/`p-badge` use      |
| Dense icon button with strong chrome | Ghost/text icon action at rest, subtle Zinc hover, visible focus                            | `p-button text` usage and map control templates     |
| Large decorative dialog radius       | 12px neutral dialog with restrained border and `shadow-xl`                                  | Aura modal tokens                                   |
| Borderless list row                  | Transparent border at rest, soft Zinc hover and subtle border, 8px radius                   | `place-list-item.component.html`                    |

## 5. Ordered work packages

Each work package is a separate commit. At the end of each package, inspect
`git diff --check`, the explicit file list, and the relevant rendered screens.
Do not stage unrelated worktree changes.

### Package 1 — source audit and provenance (P0)

Files:

- `docs/ui/trip-reference-audit.md`
- `docs/ui/trip-style-migration-plan.md`
- existing `docs/licenses/TRIP-MIT.txt` (verify, do not rewrite unless the
  upstream notice differs)

Actions:

- Pin TRIP repository URL, tag, and commit.
- Record root and dependency licenses.
- Record exact source paths, tokens, component usage, and Trasolve mappings.
- Record the actual branch/HEAD/worktree without checkout/reset/stash.

Gate: documentation only. No frontend or application source change.

### Package 2 — tokens and global foundation (P1)

Primary files:

- `frontend/src/app/styles/theme.css`
- `frontend/src/app/styles/global.css`

Actions:

- Map neutral primary, canvas/surface, text, border, semantic state, radius,
  shadow, motion, and overlay material values into existing tokens.
- Preserve every existing alias used by feature CSS.
- Keep `[data-theme='light'|'dark']`; do not adopt `.dark` as a runtime
  requirement.
- Keep the 15px Inter-first system stack without adding a font asset or
  network font dependency.
- Retain a clearly visible focus ring in both themes. Any divergence from
  TRIP's 1px neutral ring must be documented as an accessibility adaptation.
- Keep layout constants and responsive values out of token changes.

Visual example: Blue/navy theme semantics become Zinc/neutral semantics while
the same DOM boxes remain in the same positions and sizes.

Gate:

- light/dark root colors and native controls are readable;
- no variable becomes undefined;
- no map/layout dimension changes in the diff;
- theme switching and `system` mode still work.

### Package 3 — shared elements (P1)

Primary files:

- `frontend/src/shared/ui/primitives.css`
- `frontend/src/shared/ui/Button.tsx`
- `frontend/src/shared/ui/IconButton.tsx`
- `frontend/src/shared/ui/Dialog.tsx`
- `frontend/src/shared/ui/Panel.tsx`
- `frontend/src/shared/ui/StatusBadge.tsx`
- `frontend/src/shared/ui/Tooltip.tsx`
- `frontend/src/app/styles/theme.css` for language/theme controls only

Expected implementation is CSS-only unless a component already lacks a
styling hook. Do not alter public props or behavior.

| Element               | Target                                                                                      | Must remain unchanged                                         |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Button                | neutral primary, bordered secondary, ghost text/icon action, 6-8px radius, short transition | size props, loading/disabled behavior, click/submit semantics |
| Icon button           | same visual variants with compact square hit target                                         | accessible name, icon, target size                            |
| Input/select/textarea | surface, subtle border, 6-8px radius, field focus boundary                                  | native behavior, fields, validation, measured dimensions      |
| Panel/card            | one-pixel neutral border, 8-12px radius, low elevation                                      | padding and content hierarchy unless separately verified      |
| Dialog                | 12px surface, modal shadow, neutral mask                                                    | body portal, focus trap/restore, Escape/backdrop, scroll lock |
| Tooltip               | dark neutral surface, compact padding/radius/shadow                                         | `aria-describedby`, hover/focus behavior                      |
| Badge                 | compact soft semantic rectangle                                                             | status meaning and text                                       |
| Progress/empty state  | neutral track/muted hierarchy                                                               | progress semantics, animation and reduced motion              |

Do not add shared Card/Select/Tab/Menu abstractions merely to resemble
PrimeNG. Style current selectors and components at their existing boundary.

Gate: keyboard focus, disabled states, loading states, dialog nesting, portal
theme, and reduced motion are manually checked.

### Package 4 — map workspace appearance (P2, P0 protected)

Primary files, in recommended order:

1. `frontend/src/features/map-workspace/styles/map.css`
2. `frontend/src/features/map-workspace/styles/quick-search.css`
3. `frontend/src/features/map-workspace/styles/bottom-context-panel.css`
4. `frontend/src/features/map-workspace/styles/trip-maps.css`
5. `frontend/src/shared/ui/map/place-info-card.css`
6. `frontend/src/map/components/anchored-map-card.css`
7. `frontend/src/features/place-editor/ui/map-toolbar.css`
8. `frontend/src/features/auth/ui/map-user-controls.css`
9. `frontend/src/features/map-workspace/components/share/share-trip-modal.css`
10. other map overlay CSS only when a concrete inconsistency is observed

Selector order:

1. outer overlay surface/material;
2. headers and compact controls;
3. list/layer rows and selected/hover states;
4. detail cards and bottom panels;
5. search results, menus, and transient overlays;
6. semantic/dynamic data-color surfaces.

Map-specific rules:

- Do not edit `.trip-map-workspace` columns, `--trip-panel-width`, breakpoints,
  panel position, map size, or visibility rules.
- Do not change TSX structure or handlers for a styling convenience.
- Use `--shadow-map-overlay` for every floating map surface. Replace current
  map use of `--shadow-map-overlay-menu` in a later implementation commit;
  keep stronger dialog elevation only for true dialogs outside the map
  floating-surface rule.
- Do not apply surface shadows to markers, selection halos, focus rings, DnD
  indicators, route lines, timeline handles, or active drawing state.
- Keep dynamic day/place/polyline colors. Only their supporting opacity,
  border, or text contrast may be mapped to tokens.
- Avoid adding `transform`, `filter`, `overflow`, `position`, or new stacking
  contexts to Google Map ancestors and portal anchors.
- Backdrop blur must be checked for map panning performance and contrast.

Visual example: the existing left panel and map overlays gain translucent
white/Zinc material, 8px geometry, compact ghost actions, and soft Zinc row
hover without moving or resizing anything.

Gate: verify actual Google Maps loading, resize, pan/zoom, marker click and
double-click focus, layer/place double-click focus, quick-search keyboard flow,
all DnD paths, map popovers, menus, dialogs, and mobile panel rules.

### Package 5 — remaining screens and scoped theme cleanup (P3)

Primary files:

- `frontend/src/pages/landing/styles/landing.css`
- `frontend/src/pages/analytics/analytics-page.css`
- `frontend/src/features/analytics-overlay/analytics-overlay.css`
- `frontend/src/features/analytics-funnels/ui/analytics-funnels.css`
- `frontend/src/features/ai-chat/ui/chat-panel.css`
- `frontend/src/features/auth/ui/account-settings.css`
- `frontend/src/features/preferences/ui/preferences-modal.css`
- `frontend/src/pages/share/public-share.css`
- feature-specific dialog/card CSS discovered by rendered review

Actions:

- Replace remaining hard-coded former palette values with semantic tokens
  only when their role is unambiguous.
- Align cards, status chips, tabs, menus, tooltips, empty states, and dialogs
  with the shared expression.
- Preserve analytics visualization colors when they encode series or state.
- Keep Blueprint imports and overrides scoped to existing troute/tcache
  testbeds. Do not restyle Blueprint globally.
- Keep inline SVG implementations; do not introduce PrimeIcons.

Visual example: landing, trip selection, public share, account/preferences,
AI, and analytics surfaces use the same Zinc hierarchy as the map without
adopting TRIP's page layouts.

Gate: all routes, navigation, information order, form fields, and localization
keys are unchanged.

### Package 6 — regression verification and finish (P4)

No production behavior change belongs in this package. Only documentation or
small, directly evidenced style corrections may be committed.

Automated/static checks:

1. `git diff --check`
2. targeted Prettier check for changed files
3. `npm run typecheck`
4. `npm run lint`
5. `npm test` using the existing suite only
6. `npm run build`
7. CR-byte scan for every changed text file
8. dependency and source-file audit confirming no new UI package, asset, test,
   API, model, backend, database, or deployment change

Manual real-UI matrix:

| Area                  | Light    | Dark     | Desktop        | Mobile/narrow          | Critical interactions                               |
| --------------------- | -------- | -------- | -------------- | ---------------------- | --------------------------------------------------- |
| Landing/trip picker   | required | required | required       | required               | navigation, theme/language                          |
| Map workspace         | required | required | required       | required               | real map load, resize, pan/zoom, marker/layer focus |
| Layer/place editing   | required | required | required       | required               | forms, DnD, double-click, menus, timeline handles   |
| Quick search/overlays | required | required | required       | required               | keyboard open/close, focus restore, portal stacking |
| Dialogs/account/share | required | required | required       | required               | Escape, backdrop, scroll lock, validation           |
| AI/analytics          | required | required | required       | representative widths  | SSE/progress display and data-color contrast        |
| Blueprint testbeds    | required | required | representative | as currently supported | scoped CSS remains intact                           |

Final diff review must confirm that the only changes are visual CSS/tokens and
the required documentation/license notice. Any TSX change needs an explicit
explanation proving that it is a styling hook and does not alter behavior.

## 6. File-level application matrix

| File/group                        | TRIP evidence applied                                                     | Priority | Main regression to watch               |
| --------------------------------- | ------------------------------------------------------------------------- | -------: | -------------------------------------- |
| `app/styles/theme.css`            | Zinc primary/highlight, semantic states, radii, shadows, overlay material |       P1 | token aliases and both themes          |
| `app/styles/global.css`           | 15px Inter-first typography, selection, focus, reduced motion             |       P1 | wrapping and focus visibility          |
| `shared/ui/primitives.css`        | button/dialog/card/badge/tooltip expression                               |       P1 | hit targets, disabled/loading, portals |
| `map-workspace/styles/map.css`    | floating material, compact controls, list hover/selection                 |       P2 | 468/320/mobile geometry, DnD           |
| `quick-search.css`                | compact field/results/menu surface                                        |       P2 | keyboard flow and measured columns     |
| `bottom-context-panel.css`        | modal/card/list/status hierarchy                                          |       P2 | fixed/max heights, nested portals      |
| `trip-maps.css`                   | trip picker cards and map previews                                        |       P2 | preview/map bounds and navigation      |
| map/detail/toolbar CSS            | tooltip, menu, detail surface, ghost icon actions                         |       P2 | anchor position, stacking, map events  |
| landing/share/account/preferences | neutral cards/forms/dialogs                                               |       P3 | responsive layout and form behavior    |
| AI/analytics CSS                  | neutral chrome while preserving data colors                               |       P3 | streaming/progress and chart contrast  |
| troute/tcache testbed CSS         | scoped compatibility only                                                 |       P3 | Blueprint leakage                      |

## 7. Decisions not to migrate

- TRIP's left/right panel arrangement, map placement, route/view structure,
  and information architecture.
- Angular dependency injection, components, templates, or Transloco setup.
- PrimeNG component APIs, Aura runtime, Tailwind utility classes, PrimeIcons,
  Leaflet, or its plugins.
- TRIP map tiles, marker implementation, context-menu implementation, route
  animation, screenshots, logos, cover art, or favicons.
- TRIP's resizable plan panel and its pointer handlers.
- Unused Aura component defaults simply because they exist in the preset. For
  example, actual TRIP cards/badges are utility-built, so unused `p-card`,
  `p-tag`, and `p-badge` definitions are secondary evidence only.

## 8. Open items for later implementation stages

- Reconcile the current `--shadow-map-overlay-menu` declaration/usages with
  the repository rule requiring the single `--shadow-map-overlay` token.
- Decide through rendered light/dark keyboard review whether Trasolve's 2px
  blue focus ring remains the accessibility adaptation or can move closer to
  TRIP's 1px neutral primary ring.
- Decide whether disabled opacity should change from the current button value
  `0.55` to Aura's exact `0.6`; verify loading/progress exceptions.
- Verify whether the current 240px Tooltip maximum should remain for Trasolve
  content or move toward Aura's 12.5rem/approximately 187.5px value. Do not
  reduce it if translated text clips.
- Recheck any hard-coded map/menu shadow discovered after the audit. Surface
  shadows must use the map token; state shadows should remain explicit and
  documented.

These are evidence-backed questions, not permission to change the UI during
the audit stage.
