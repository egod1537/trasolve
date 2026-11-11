# Product surface guidelines

This refinement keeps the Primer base adapter and light/dark theme preference.
The final `refined-surfaces.css` layer supplies Trasolve's neutral surface colors.
The product workspace uses a quiet map background, readable floating surfaces,
and a common selection language for the active layer, place and tool.

## Shared tokens

| Token                  | Value / purpose                                       |
| ---------------------- | ----------------------------------------------------- |
| `--radius-overlay`     | 18px for map panels, place cards and companion panels |
| `--radius-control`     | 8px for standard buttons and fields                   |
| `--control-height-sm`  | 32px for compact controls and close buttons           |
| `--control-height-md`  | 38px for standard controls                            |
| `--panel-padding`      | 20px horizontal header/body spacing                   |
| `--panel-title-size`   | 18px for place, route and chat headers                |
| `--panel-title-weight` | 600 for panel titles; primary row names use 500       |
| `--panel-body-size`    | 13px for compact product controls                     |
| `--panel-meta-size`    | 12px for secondary panel information                  |
| `--panel-divider`      | Subdued separator derived from the theme border       |
| `--panel-header-bg`    | Slight surface tint separating header and body        |

Map panels and compact controls share a 50% opaque glass material through
`--map-overlay-opacity`, with a 24px backdrop blur and a subtle transparent
header tint (15% neutral tint). Sidebar action strips and selection rows use
transparent tints so nested solid backgrounds do not hide the glass. Unsupported
backdrop filtering and reduced-transparency preferences use solid surfaces;
reduced transparency also disables the blur. Every floating map surface uses
`--shadow-map-overlay`, with quieter light/dark geometry defined centrally.
Product feature styles retain responsibility for fixed heights, responsive
placement, scroll regions and content-specific sizes. Billing's fixed,
non-scrolling plan layout is unchanged.

## Interaction states

- Neutral hover and pressed/expanded selection have different treatments. Blue
  marks the selected tool/layer/place and primary actions; individual Day colors
  remain the identity of their layers and marker fills.
- Buttons use the common focus outline and a one-pixel active translation.
  Disabled controls keep their current semantics; loading buttons use a progress
  cursor. Search and chat compose fields expose a visible focus treatment.
- Marker selection uses a blue ring and a restrained scale, retaining the
  existing route and drawing state overrides. Marker callouts use theme colors
  in both light and dark mode.
- Popup entry fades without scaling or translating the measured surface. The
  anchored map wrapper still owns placement. The chat panel uses a short 12px
  entry instead of travelling its full width. Existing reduced-motion rules
  suppress animations and transitions.

`MapPopupCardShell` uses the shared compact `IconButton` for close controls.
Map sidebar, route companions, place cards, search results, menus and AI chat
consume these tokens in their own stylesheets; no feature-specific selectors are
added to global theme files. No new fonts, packages or localized strings are
introduced.
