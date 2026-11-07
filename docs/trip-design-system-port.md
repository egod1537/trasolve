# TRIP design-system port

## Scope and fixed baselines

- Trasolve repository: `egod1537/trasolve`
- Working branch: `impl`
- Start HEAD: `46ba60903370ae59faef4633e2aba27eb810c7ca`
- Start worktree: clean
- Start relationship to local `main`: 11 commits ahead, 0 commits behind
- Reference repository: `itskovacs/trip`
- Pinned reference HEAD: `856b1edfe81a735fce4b544c2e16a6518cebf164`
- Reference license: MIT, `Copyright (c) 2026 Kovacs`

The six named specification text files were not present in the checkout, its
ignored files, the parent project directory, or the public Trasolve repository.
The task brief, its ordered stage names, and its explicit invariants are
therefore the controlling specification for this port.

No merge, rebase, reset, framework replacement, or new UI library is part of
this work. Existing layout, information architecture, routes, map/runtime
boundaries, state, persistence, authentication, backend contracts, input
behavior, keyboard behavior, pointer behavior, drag-and-drop behavior, and
responsive visibility rules remain fixed.

## Primary evidence

The design decisions below come from these files in the pinned TRIP checkout:

- `src/src/mytheme.ts`: Aura semantic color override and light/dark primary
  states.
- `src/src/styles.scss`: Inter typography, map overlay surfaces, shadows,
  radii, context menus, state treatments, and motion.
- `src/src/app/components/dashboard/dashboard.component.html`: translucent
  map controls, filter panels, list panels, compact controls, and state chips.
- `src/src/app/components/trips/trips.component.html`: trip gallery cards and
  top actions.
- `src/src/app/components/trip/trip.component.html`: itinerary rows, panels,
  toolbars, forms, and detail surfaces.
- `src/src/app/shared/place-list-item/place-list-item.component.html`: place
  list hierarchy, hover treatment, metadata, and category chips.
- `src/src/app/shared/place-box-content/place-box-content.component.html`:
  detail hierarchy, labels, badges, icon actions, and copy fields.
- `src/src/app/components/auth/auth.component.html`: form hierarchy and the
  restrained neutral primary action.
- `docs/static/img/sc_map.jpg`, `sc_trip.jpg`, `sc_trips.jpg`, and
  `map_places_panel.png`: rendered component relationships and visual density.

The public demo landing page identified its deployed demo as `1.43.2` while
the repository advertised `1.50.1`. The pinned current source is authoritative
when the older rendered demo and current implementation differ.

## Extracted visual language

### Color

TRIP replaces a brand-colored primary scale with Tailwind Zinc. Primary
buttons and selected controls use near-black in light mode and near-white in
dark mode. Blue is retained for focus, informational selection, and a small
number of explicit states; it is not the default surface accent.

| Role                | Light                            | Dark                             | Source                   |
| ------------------- | -------------------------------- | -------------------------------- | ------------------------ |
| App canvas          | Zinc 50 `#fafafa`                | Zinc 950 `#09090b`               | Tailwind/Aura Zinc       |
| Main surface        | White `#ffffff`                  | Zinc 900 `#18181b`               | dashboard and panels     |
| Subtle/hover        | Zinc 100 `#f4f4f5`               | Zinc 800 `#27272a`               | list and icon hover      |
| Strong text/action  | Zinc 900–950 `#18181b`–`#09090b` | Zinc 50 `#fafafa`                | theme preset             |
| Secondary text      | Zinc 600 `#52525b`               | Zinc 300–400 `#d4d4d8`–`#a1a1aa` | labels and metadata      |
| Border              | Zinc 200 `#e4e4e7`               | Zinc 700 `#3f3f46`               | panels and fields        |
| Informational focus | Blue 600 `#2563eb`               | Blue 400 `#60a5fa`               | search/selection states  |
| Success             | Emerald/Green 600                | Emerald/Green 400                | booked/positive states   |
| Danger              | Red 600                          | Red 400                          | destructive/error states |

Category/day colors remain data colors. They are not replaced by the neutral
system. Dynamic color chips use a low-opacity color mix so the data color is
legible without becoming a large saturated surface.

### Typography

- Family: Inter with system sans-serif fallbacks.
- Root size: 15px.
- Dense UI copy: 12–14px; body and control copy: 14–15px.
- Common weights: 500 for actions/body emphasis, 600 for headings, and 700
  only for compact counts or strong headings.
- Metadata labels use 12px, 600 weight, uppercase, and restrained tracking.
- Large display type is confined to presentation/auth contexts, not the map
  workspace.

### Shape, depth, and motion

- The dominant radius is 8px (`rounded-lg`), followed by 4px, 6px, and 12px.
- Pills are reserved for status/category data, not every button.
- Borders are one-pixel, low-contrast Zinc boundaries.
- Ordinary cards use small/default shadows. Large shadows are mainly for
  floating map surfaces and dialogs.
- Map overlays use approximately 70% surface opacity with a strong backdrop
  blur, plus a low-opacity ring and shadow.
- Interaction motion is short (roughly 150–300ms) and mainly changes color,
  opacity, or a small transform. Reduced-motion behavior must remain intact.

### Component expression

- Primary button: neutral filled surface; secondary button: bordered white or
  dark Zinc surface; icon actions: text/ghost until hover.
- Form fields: solid surface, subtle border, 8px radius, blue focus boundary.
- Panels: neutral surface, subtle border, minimal decorative chrome.
- List rows: transparent at rest, Zinc hover surface, optional subtle border,
  compact metadata below the main label.
- Badges: small rounded rectangles with soft semantic backgrounds rather than
  saturated full-width fills.
- Dialogs: raised neutral surface, restrained border, 12–16px radius, and a
  stronger but soft shadow.
- Empty/loading states: muted Zinc text and icons, preserving the same content
  and actions.
- Map controls: translucent surface, backdrop blur, 8px radius, compact icon
  hit targets, and separators between related groups.

## Trasolve token mapping

The port uses Trasolve's existing semantic tokens instead of copying Angular,
PrimeNG, Tailwind utilities, markup, or component structure.

| Trasolve token family                                     | TRIP interpretation                                 |
| --------------------------------------------------------- | --------------------------------------------------- |
| `--color-bg`, `--color-surface*`                          | Zinc canvas and surfaces                            |
| `--color-text-*`, `--color-border*`                       | Zinc text/border hierarchy                          |
| `--color-accent*`                                         | Neutral primary action hierarchy                    |
| new informational/selection tokens                        | TRIP's limited Blue UI states                       |
| `--color-success*`, `--color-danger*`, `--color-warning*` | soft Tailwind semantic states                       |
| `--radius-*`                                              | 4/6/8/12/16px geometry without changing layout      |
| `--shadow-*`                                              | lower-contrast card depth and focused overlay depth |
| `--shadow-map-overlay`                                    | the single required map floating-surface shadow     |

The existing aliases stay available so feature CSS can migrate without
functional refactors. Layout constants such as `--trip-panel-width`, map
viewport dimensions, and responsive breakpoints are explicitly excluded from
token changes.

## Ordered implementation record

1. Source investigation and necessary token extraction: this document and the
   preserved MIT notice.
2. Design tokens and global style: Zinc light/dark semantics, typography,
   focus, radii, shadows, and overlay material tokens.
3. Shared element styling: buttons, icon buttons, panels, dialogs, badges,
   progress, tooltips, language/theme controls, and common inputs.
4. Map workspace appearance: surfaces, rows, headers, search, toolbar, detail
   cards, and map controls without changing placement or behavior.
5. Remaining screens and theme cleanup: landing, trip picker, public share,
   preferences/account/share dialogs, and internal pages using shared tokens.
6. Regression verification and finish: light/dark visual checks, responsive
   checks, interaction checks, typecheck, lint, build, repository diff audit,
   line-ending audit, and provenance audit.

## Completion and verification

### Stage commits

| Stage                      | Commit      | Result                                                                             |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| 1. Source investigation    | `a764d81`   | Pinned evidence, extracted design language, and MIT notice                         |
| 2. Tokens and global style | `bbd2326`   | Zinc light/dark palette, semantic states, type, radii, depth, and overlay material |
| 3. Shared elements         | `61a262d`   | Buttons, panels, dialogs, badges, progress, tooltips, controls, and form fields    |
| 4. Map workspace           | `ffed5c7`   | Sidebar hierarchy, translucent map surfaces, search, toolbars, cards, and controls |
| 5. Remaining screens       | `b0b14aa`   | Landing, trip picker, share/account surfaces, AI panel, and analytics surfaces     |
| 6. Verification            | this record | Automated checks, real-browser light/dark and mobile checks, and repository audits |

### Automated checks

- `npm run typecheck`: passed for shared, frontend, backend, and localization
  TypeScript projects.
- `npm run lint`: passed with exit code 0. The localization report found no
  hardcoded UI literals, invalid `L()`/`NL()` calls, empty translations,
  structure mismatches, or forbidden disables.
- `npm test`: passed all 9 existing backend contract tests.
- `npm run build`: passed for shared, backend, and the frontend production
  Vite build.
- Targeted Prettier check for every file in this port: passed after formatting
  this record.
- Frontend architecture and dependency boundaries were not changed; all
  implementation changes outside this report and license are CSS-only.

### Real-browser checks

- At 1440×1000, the landing page, trip picker, map workspace, and analytics
  page were rendered in both light and dark themes against the running
  development backend and real Google Maps SDK.
- At 390×844, debug guest login, trip opening, the responsive map/sidebar,
  `Ctrl+K` quick-search opening, `Escape` closing, and layer selection all
  succeeded.
- The desktop panel width remains 468px, the existing 320px intermediate
  breakpoint remains unchanged, and the mobile panel positioning/visibility
  rules remain unchanged.
- Map runtime, adapters, map data, markers, routing, persistence, auth, AI,
  SSE, drag-and-drop handlers, keyboard handlers, routes, and component markup
  were not modified by this port.

### Audits and pre-existing findings

- All files changed by this port use LF line endings and contain no CR bytes.
- Every map floating surface changed by this port continues to use the global
  `--shadow-map-overlay` token. State rings and marker halos remain separate
  because they communicate selection, drawing, or focus state.
- No package, dependency, test file, test helper, fixture, data model, API
  contract, backend, database, deployment file, localization resource, or
  image/icon asset was added or changed.
- The repository-wide Prettier check still reports two unrelated files that
  were already outside this port: `routeOptimization.ts` and `troute.ts`.
  Targeted formatting for the port itself passes.
- The existing architecture check reports four unrelated public-slice import
  findings in preferences/auth/share code. This CSS-only port does not change
  those imports.
- Localization lint still inventories 98 pre-existing missing analytics keys
  and 21 unused keys while exiting successfully. No user-facing string or
  localization key was introduced here, so the localization Spreadsheet and
  production snapshots were intentionally left unchanged.

## Provenance policy

This port translates visual findings into Trasolve semantic CSS. It does not
copy TRIP application logic, Angular templates, PrimeNG components, Tailwind
utility markup, image assets, or icons. The original license is nevertheless
preserved in `docs/licenses/TRIP-MIT.txt`, and this document records the exact
source revision and the source files that informed the adaptation.
