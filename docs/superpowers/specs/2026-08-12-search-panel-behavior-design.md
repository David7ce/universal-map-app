# Left panel (search) collapse behavior + cohesion — design

## Context

First of five sub-projects from a larger request (left panel behavior, date-range filter, more filter dimensions, welcome page redesign, event list sorting/pagination) — split because each is an independent, separately-reviewable change. This spec covers only the left panel.

`SearchOverlay.ts` (`#search-overlay`, the left panel) already has three content states — search results, selected-feature info, and (as of the previous session) an idle-state day agenda listing `store.selectedDate`'s events. All three are driven by `store.panels.left` (`'open' | 'closed'`) plus local `searchInput`/`selectedFeatureId` state.

The bug: `@media (min-width: 64rem)` in `styles.css` forces the panel permanently visible on desktop (`.map-search[hidden] { display: block; }`, `.control-btn--search { display: none; }`), independent of `panels.left`. Mobile behaves correctly (collapsed to a toggle icon, opens on demand). This is why the day agenda — meant to be an on-demand view — reads as "always sitting open" on desktop.

## Scope

- Unify open/closed behavior across breakpoints: both driven by `store.panels.left`, no breakpoint-specific override of the hidden state.
- Wire `CalendarBar.ts`'s day-pick (month/year grid click) to open the left panel — currently it only sets `selectedDate`, so picking a day updates a panel the user isn't necessarily seeing.
- Add a result count line to the search-results state.
- Light visual consistency pass across the three content states (results / info / day agenda) — no new states, no new interactions beyond the two above.

Out of scope (separate specs): date-range filter, region/price/type filter dimensions, welcome page, event list sorting/pagination.

## Behavior

`store.panels.left` semantics are unchanged (`'open' | 'closed'`); what changes is which breakpoints respect it.

Opens on:

- Click the search toggle icon (existing — the only way to reach the input at all once desktop's forced-visibility override is gone, since the input lives inside the now-actually-hidden `.map-search`).
- Select a search result or click a map feature (existing — `selectFeature` already sets `panels: { left: 'open', ... }`).
- **New:** pick a day in `CalendarBar.ts`'s month/year grid (`selectDay`) — calls `openPanel(store, 'left')` alongside the existing `store.set({ selectedDate })`.

Content shown when open, in priority order (unchanged from current logic, just now actually reachable/hideable):

1. A feature is selected → info view.
2. Search query non-empty → results view.
3. Otherwise → day agenda for `state.selectedDate`.

Closes on: toggle icon (acts as close while open, existing `[aria-expanded='true']` hides the open-icon and the panel's own close button appears), backdrop click (mobile), Escape, clearing an empty search with no selection (existing `close()`/`clearButton` logic — unchanged).

## CSS changes

`styles.css`'s desktop media query (`@media (min-width: 64rem)`, currently lines ~362-405):

- Remove: `.control-btn--search { display: none; }`, `.map-search[hidden] { display: block; }`, `.map-search__close { display: none; }` — these three are what force permanent visibility and hide the controls that would otherwise manage it.
- Keep: the docked-top-left positioning, no-backdrop, dropdown-style absolute-positioned results — desktop's distinct chrome is a visual choice independent of open/closed timing, and stays.
- Net effect: desktop gets the same toggle-icon-in-top-left / click-to-open-a-dropdown pattern mobile already has as a full-screen-modal variant, just styled as a compact anchored panel instead of a full-screen overlay.

## Result count + cohesion

- `renderInfo`/`renderDayAgenda` already open with a heading-like line (info has no heading currently — leave as is, it's a single feature, a count doesn't apply). Add a `<p class="search-results__count">` above the results list in `runSearch()`. New string `search.resultCount`: `"{{count}} results"`, added to all 4 worlds' `strings.json` — no singular/plural variant (matches this project's existing convention: `WelcomeView.ts`'s `itemCount`/`itemNoun` line has the same non-pluralized shape, e.g. "1 events"). Zero results already has its own message (`search.noResults`) and doesn't render the count line at all.
- Visual: `search-day-agenda__item-btn` and `search-result-item` already share nearly the same look (border/hover/padding) — bring them fully into line (same border-radius, same hover background token) so switching between the two states doesn't feel like two different components. No structural markup change, CSS-only.

## Testing

No new pure functions — this is DOM/CSS behavior, consistent with this file's existing untested-by-design UI wiring (per `CalendarView.ts`/`CalendarGrid.ts` precedent: DOM interaction verified manually via dev server + Playwright, not unit tests). `npx vitest run` must still pass unchanged (no engine-layer changes).

## Verification

- `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .` all clean.
- Manual, via Playwright against the dev server, on both a mobile-width and desktop-width viewport:
  - Panel starts collapsed on load (both widths).
  - Typing opens it and shows results with a count; clearing back to empty reverts to the day agenda.
  - Selecting a result/map feature shows info; closing returns to collapsed.
  - Picking a day in the right panel's month/year grid opens the left panel showing that day's agenda.
  - Zero console errors.
