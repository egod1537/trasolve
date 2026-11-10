# Dotted-map landing page

Implements the approved reduced-copy white/blue landing concept: a large
East Asia globe, short two-line headline, a header login/profile action, and a Tokyo
example itinerary below the hero. The single hero start action retains the
existing Google sign-in and map entry flow. The duplicate header start action,
service introduction link, and example link are removed.

Below the itinerary, a three-part planning overview illustrates travel schedules,
movement paths, and route optimization with short existing localized descriptions.
The illustrations are decorative SVGs, with no fabricated metrics or API requests.
Soft blue blurred backgrounds and lightly frosted panels add depth while keeping
the copy and map points sharp. The overview stacks on narrow screens.

## Geographic graphics

- Dependency: `mappo@0.3.0`, pinned to the published npm release.
- Source: <https://github.com/rameerez/mappo>, MIT notice in
  `docs/licenses/Mappo-MIT.txt`.
- Uses the public `buildGlobePoints`, `latLonToXYZ`, and `isLand` geometry
  exports. `visuals/mappo.d.ts` declares only these exports, because this
  package does not ship TypeScript declarations.
- Geographic points are built once, then projected onto Canvas in six depth
  bands. Grid lines, markers and connecting arcs share the same projection.
  No Google Maps requests or WebGL context are needed.
- The globe starts on East Asia at -130 degrees (15 degrees farther left)
  and rotates around its polar axis at 2 degrees per second, drawing at most
  30 frames per second. It uses 80% of the available forward sweep before a
  marker or label is clipped by the viewport or reaches the rear hemisphere,
  bringing the turnaround 20% earlier. It quickly
  reverses to the starting angle over 850ms with easing, then repeats.
  Seoul, Japan (Tokyo),
  and Mongolia (Ulaanbaatar) markers move with their real coordinates and
  fade out on the back hemisphere.
- Animation pauses offscreen and in hidden tabs. Reduced motion uses a static
  frame, including when the preference changes during the visit. The effect
  cancels its animation and disconnects observers on unmount. Canvas sizing
  responds to layout changes and caps pixel density at 2; colors are refreshed
  from the app's semantic tokens on theme changes.
- The regional illustration locates Tokyo on the real coastline. The nearby
  list shows its neighborhood stops separately, rather than spreading Tokyo
  neighborhoods across all of Japan as in the initial concept image.

## Copy

The approved copy is registered under `common:landing` for Korean, Japanese,
English, and Mongolian. Its source is the configured localization Spreadsheet,
`common!A57:G67`; earlier entries were retained.

The standard service-account CLI could not authenticate in this environment.
The connected Google Sheets API supplied the live source rows instead, and
the repository's `generateLocalizationResources` function generated the four
production `common.json` snapshots from that source. No translation JSON was
used as an independently edited source.

The planning overview reuses existing keys with the same meaning; it does not
change the localization source or generated resources.

The example place names are demo itinerary data. They are not new application
status or action strings.

## Validation

- Repository type checking and production build pass.
- Oxlint and ESLint pass, including the user-facing literal rule.
- The full localization lint reports the same 98 pre-existing missing
  `analytics` keys as the parent revision. No new missing keys, empty
  translations, locale shape mismatches, or interpolation mismatches.
