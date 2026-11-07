# TRIP UI verification

## 1. Stage 5 baseline and scope

Stage 5 started on 2026-11-07 from the clean `impl` worktree at
`35f5211511dcf480314bc11a361cdae3f351fdda`. The branch was 37 commits ahead
of `origin/impl`; `main...HEAD` was `0 23`. No checkout, merge, rebase, reset,
stash, dependency change, or generated localization resource change was made.

This stage extends the Stage 2 semantic tokens and Stage 3 primitives to the
remaining routes. It does not change route definitions, DOM order, form
fields, data fetching, auth, map/runtime code, stores, controllers, or API
contracts.

## 2. Route and surface impact matrix

| Route or surface            | Existing implementation                               | Stage 5 visual scope                                                                | Protected behavior                                               |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                         | `LandingPage`, `landing.css`                          | Profile control, popup menu, buttons, tokenized focus/elevation                     | Hero composition, links, login flow, responsive breakpoints      |
| `/map`                      | `MapPage`, map workspace and trip picker              | No Stage 5 map-workspace restyle; account fallback alignment is shared with landing | Stage 4 geometry, map SDK, trip selection/editing, DnD, overlays |
| `/analytics`                | `AnalyticsPage` and analytics feature CSS             | Audited existing semantic cards/states; pill geometry now uses the radius token     | Tabs, query period, charts, analytics API and series colors      |
| `/testbed`                  | `TestbedPage`, `testbed.css`                          | Card elevation, hover surface, tokenized radius                                     | Card count, descriptions, destinations                           |
| `/testbed/google-maps`      | `GoogleMapsTestPage`, Google place search             | Card hierarchy, dropdown elevation, radius/status consistency                       | Real Google SDK, search/routes calls, debug output               |
| `/testbed/ai-chat`          | `AiChatTestPage`, shared chat panel                   | Toolbar hover, model card, field and panel elevation                                | Model selection, message state, chat API                         |
| `/testbed/google-oauth`     | `GoogleOAuthTestPage`                                 | Card/button states, radius and elevation                                            | OAuth redirect and result rendering                              |
| `/testbed/troute`           | Blueprint troute testbed                              | Scoped Blueprint palette, focus, controls, cards, popovers and dialog portal        | Job/SSE/API behavior, builder fields, result rendering           |
| `/testbed/tcache-route`     | Blueprint tcache testbed                              | Same scoped Blueprint bridge plus map candidate material                            | Job/SSE/API behavior, builder fields, map selection              |
| `/testbed/localization`     | `LocalizationTestPage`                                | Review only; it already uses the Stage 2/3 tokens                                   | Locale/resource inspection and switching                         |
| `/share/:token`             | `PublicSharePage`                                     | Map overlay radius and correct app background for loading/error/empty states        | Token resolution, read-only map, copy action                     |
| Account/preferences dialogs | Shared auth/preferences features; no standalone route | Neutral avatar fallback and tokenized close/badge geometry                          | Auth state, theme/language persistence, dialog events            |

There is no standalone login route in `impl`. Login is exposed from the
landing and map controls. Trip selection and management are also contained in
the `/map` trip picker rather than separate routes.

## 3. Applied mapping

| Existing expression                                                 | Stage 5 mapping                                                                                            | Reason                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Landing profile gradients and feature-local popup values            | `--accent`, `--accent-hover`, `--shadow-card`, `--shadow-popup`                                            | Use the same neutral TRIP-derived action and elevated-surface language as the shared primitives   |
| Hard-coded `4px`, `6px`, `8px`, `12px`, `999px` in reviewed pages   | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`                                | Preserve the rendered geometry while making the Stage 2 token source traceable                    |
| Testbed cards and panels without a shared elevation                 | `--shadow-card`                                                                                            | Match shared cards without changing padding or layout                                             |
| Testbed place-search dropdown                                       | `--shadow-popup`                                                                                           | Match the shared popup/menu role                                                                  |
| Troute/tcache Blueprint blue intent and 4px controls                | Scoped Blueprint custom properties backed by `--accent`, semantic surfaces, focus, radii and shadow tokens | Prevent global Blueprint leakage while retaining its component behavior                           |
| Blueprint dialog/popover literals that bypass its custom properties | Shell-presence-scoped portal selectors                                                                     | Blueprint 6 keeps literal dialog/header/select styles; the portal needs an explicit scoped bridge |
| Job-builder place candidates above a map                            | `--color-map-overlay-surface`, `--color-map-overlay-ring`, `--shadow-map-overlay`, `--map-overlay-blur`    | Satisfy the repository-wide map floating-surface rule                                             |
| Undefined `--bg-canvas` on public-share states                      | `--bg-app`                                                                                                 | Restore the existing semantic app background in both themes                                       |

No TRIP source file, icon, font, image, or component code was copied in this
stage. The work only references the tokens and mappings documented in
`trip-reference-audit.md`.

## 4. Manual rendered verification

Environment: production build served by Vite preview on `127.0.0.1:4173`,
Chrome 157, desktop `1440×1000`, and narrow/mobile emulation `390×844`.

Status meanings:

- **Pass**: rendered and sampled in this Stage 5 run.
- **Covered**: reviewed here and fully exercised by the recorded Stage 4 gate;
  Stage 5 did not change the protected surface.
- **Blocked**: the route or state could not be reached without changing
  existing functional code or external state.

| Area                                                | Light   | Dark    | Desktop | Narrow  | Interaction and evidence                                                                                                | Status                                   |
| --------------------------------------------------- | ------- | ------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Landing                                             | Pass    | Pass    | Pass    | Pass    | No horizontal overflow; login CTA and existing breakpoints retained                                                     | Pass                                     |
| Map/trip picker                                     | Covered | Covered | Covered | Covered | Unauthenticated preview redirects to landing; Stage 4 recorded real SDK, trip picker, DnD and double-click focus checks | Covered                                  |
| Analytics                                           | Pass    | Pass    | Pass    | Pass    | Tabs/status shell render without overflow; chart/state colors remain unchanged                                          | Pass with localization inventory note    |
| Testbed index                                       | Pass    | Pass    | Pass    | Pass    | Card focus resolves to the shared `2px` focus ring at `2px` offset                                                      | Pass                                     |
| Google Maps testbed                                 | Pass    | Pass    | Pass    | Pass    | Real `.gm-style` map DOM and Google copyright rendered; API status remained `IDLE`                                      | Pass                                     |
| AI chat testbed                                     | Pass    | Pass    | Pass    | Pass    | Toolbar, model card, select, chat panel and scroll region render without horizontal overflow                            | Pass                                     |
| Google OAuth testbed                                | Pass    | Pass    | Pass    | Pass    | Idle/result card and login button states render; OAuth was not initiated                                                | Pass                                     |
| Troute testbed                                      | Pass    | Pass    | Pass    | Pass    | Theme switched light → dark without reload; new-job dialog opened and closed with Escape                                | Pass                                     |
| Tcache route testbed                                | Blocked | Blocked | Blocked | Blocked | Existing render-time builder validation exception occurs before the shell is mounted                                    | Blocked by pre-existing functional issue |
| Localization testbed                                | Pass    | Pass    | Pass    | Pass    | Resource/locale controls render without horizontal overflow                                                             | Pass                                     |
| Public share invalid-token state                    | Pass    | Pass    | Pass    | Pass    | Background resolves to `#fafafa` light and `#09090b` dark instead of transparent                                        | Pass                                     |
| Authenticated account dialog and valid share header | Blocked | Blocked | Blocked | Blocked | No authenticated session or valid share token was available; no auth/share data was fabricated                          | Blocked by local state                   |

All sampled narrow routes had `documentElement.scrollWidth <= innerWidth`. The
Google Maps SDK DOM was not selected by broad global `button` or `input`
rules; Stage 5 only uses page-scoped selectors.

### Blueprint portal and theme evidence

The rendered troute testbed confirms the scoped bridge remains inside the
testbed and its portal:

| Element/state           | Before Stage 5 cleanup                       | After                                                                                   |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Blueprint controls      | Default Blueprint blue and `4px` radius      | Light primary `#09090b`, dark primary `#fafafa`, `6px` radius                           |
| Light dialog portal     | Blueprint `#f6f7f9`, `4px`, Blueprint shadow | `#ffffff`, `12px`, `--shadow-dialog`                                                    |
| Dark dialog portal      | Blueprint dark surface/shadow                | Zinc `#18181b`, Zinc border, `12px`, dark `--shadow-dialog`                             |
| Light popover portal    | Blueprint popup expression                   | `#ffffff`, Zinc border, `6px`, `--shadow-popup`                                         |
| Portal dark propagation | Blueprint-owned                              | Portal has `bp6-dark`; semantic variables resolve immediately after theme state updates |

The override uses `body:has(.troute-testbed-shell)` and
`body:has(.tcache-testbed-shell)` only for Blueprint portal descendants.
Blueprint styles on unrelated routes are not globally redefined.

## 5. Protected behavior review

- Route paths, navigation targets, text/data order, card count and form fields
  are unchanged.
- No TypeScript, React state, event handler, auth, persistence, API, backend,
  database, deployment, map runtime/adapter, store, controller, SSE, AI, or
  localization resource file changed.
- Existing widths, heights, grid/flex templates, overflow, positions,
  responsive breakpoints, z-index and pointer-event rules are unchanged.
- Dynamic chart, route, place, day and status colors remain functional data;
  they were not flattened into decorative theme colors.
- The real Google Maps testbed still composes the shared map/search/routes
  implementations and loads the SDK.

## 6. Open verification items

1. `/testbed/tcache-route` currently throws the existing
   `selectLocationUsingLocationSearch` validation error while computing the
   unopened builder's request preview from its two empty initial locations.
   Stage 5 does not change this functional path. The scoped CSS is statically
   covered by build/lint and mirrors the rendered troute bridge, but a full
   tcache portal interaction remains pending a separate functional fix.
2. The local preview had no authenticated account and no valid public-share
   token. Account/preferences behavior and valid read-only share map scenarios
   remain on the final regression checklist; invalid share, login CTA and the
   shared styles were verified.
3. The analytics route renders unresolved localization keys from the existing
   localization inventory. Stage 5 adds no user-visible string or resource and
   does not bypass the localization workflow.

## 7. Final static checks

Final Stage 5 command results:

| Check                                 | Result                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Targeted Prettier                     | Pass                                                                                            |
| Typecheck                             | Pass                                                                                            |
| Oxlint / ESLint                       | Pass                                                                                            |
| Aggregate lint including localization | Existing localization inventory blocks completion: 98 missing analytics keys and 21 unused keys |
| Production build                      | Pass                                                                                            |
| `git diff --check`                    | Pass                                                                                            |
| CR-byte scan                          | Pass                                                                                            |

The localization report also confirms zero hard-coded UI literals, zero
invalid `L()`/`NL()` calls, and zero locale structure or interpolation
mismatches. Stage 5 adds no localization call, literal, or resource key.
