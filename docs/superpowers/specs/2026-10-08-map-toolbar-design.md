# Map Toolbar: unified date + filter bar

## Goal

Time and filters should feel like one connected control on the map instead of
two separate surfaces (a plain-text date in the footer, pills that often don't
appear, and a calendar buried in the right drawer).

## Audience and success

- Audience: public visitors of any world, desktop and mobile.
- Success: in every world, a visitor can see and change the selected date and
  the main filters without opening the right drawer.

## Constraints

- Static, browser-only architecture. The store (`selectedDate`,
  `activeFilters`, `calendarSystem`, `hiddenLayerIds`) is unchanged.
- Worlds without a time dimension (`no-time` class) keep working: no date UI.
- No new runtime dependencies.

## Non-goals

- Reworking the left search overlay, layer control, or lightbox.
- New calendar systems or granularities.
- Backend or data-format changes.

## Design

### New component: `MapToolbar`

`src/ui/panels/MapToolbar.ts` replaces `FilterPills.ts` and the footer
`#map-date-text`. Mounted into the existing `#filter-pills` slot (renamed
`#map-toolbar` in `index.html`).

Layout: `[‹] [Oct 8, 2026 ▾] [›] | pill pill pill [More ▾] [Clear]`

- Hidden on the Home view (as `.filter-pills` is today).
- Date group hidden when the world has no time dimension.
- Mobile (< 48rem): the bar wraps to two rows (date row, pills row); the pills
  row scrolls horizontally rather than wrapping further.

### Date chip

- Prev/next step the date by one month (the unit `CalendarBar` shows at its
  default level), using `stepMonth` (calendar-system aware; the day of month is clamped to the
  target month's length, so Jan 31 + 1 month is Feb 28) and clamped to the
  world's range with `clampDateToRange`.
- Clicking the chip toggles a popover that hosts the existing `CalendarBar`
  grid. Closes on outside click, Escape, or after picking a day. Focus returns
  to the chip on close.
- Picking a day keeps current behaviour: it sets `selectedDate` and opens the
  left agenda panel.
- `CalendarBar` is mounted once, into the popover, and removed from
  `#panel-right-time` in the drawer. The "Time" section title moves with it or
  is dropped.

### Pills and overflow

- The `MAX_DIMENSIONS`/`MAX_PILLS` cutoff is removed; the toolbar is shown in
  every world that has at least one filter dimension with values.
- Pill order: dimensions in manifest order, values in current
  `computeTaxonomyDimensions` order. A pure helper
  `splitVisiblePills(dimensions, maxVisible)` returns `{ visible, overflow }`;
  `maxVisible` is 8 on desktop and 4 on mobile.
- Overflow values appear in a "More" menu (same pill markup, toggling the same
  `activeFilters`). The button shows a count of active filters hidden inside it.
- Pills for values with zero features active on the selected date are dimmed
  (`.is-empty`, still clickable) rather than hidden. Helper
  `buildToolbarPills(layers, date, hiddenLayerIds)` returns a flat pill list
  with a per-value count for the date, built on `computeTaxonomyDimensions`. Today dimensions with no active values disappear
  entirely; they keep doing so.
- "Clear" shows only when some filter is active, as today.

### Drawer

The right drawer keeps the full filter list (`PanelRight`), the settings
control, and plugin slots. Only the calendar moves out.

### Accessibility

- Date chip is a button with `aria-haspopup="dialog"` and `aria-expanded`.
- Popover has `role="dialog"` and an accessible label from strings.
- Pills keep `aria-pressed`. "More" is a menu button with `aria-expanded`.
- New strings go in the default `strings.json` and every translated copy.

## Files

- Add `src/ui/panels/MapToolbar.ts`, `src/ui/panels/toolbar-pills.ts` (pure
  helpers), and matching `*.test.ts`.
- Remove `src/ui/panels/FilterPills.ts`; update `src/main.ts`,
  `src/ui/app-chrome.ts` (drop `mountDateText`), `index.html`,
  `src/styles.css`.
- `CalendarBar.ts` keeps its API; it is mounted in the popover.

## Testing

- Vitest unit tests: `splitVisiblePills`, `buildToolbarPills`, prev/next date
  stepping across calendar systems and range clamping.
- Extend `CalendarBar.test.ts` only if its mount contract changes.
- Manual check in the browser on all four worlds at desktop and mobile widths:
  world-leaders (many values), paranormal-spain, events-canary-islands, and a
  no-time world; popover open/close, keyboard, and drawer still functional.
- `pnpm test`, `pnpm lint` and `tsc --noEmit` must pass.

## Open decisions (defaults chosen)

- `maxVisible` values (6/4) are a starting point to tune visually.
- Prev/next steps by month; revisit if world-leaders feels better by year.
