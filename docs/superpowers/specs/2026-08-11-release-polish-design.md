# Release polish: mobile legend + systems.time gating — Design

Status: approved
Date: 2026-08-11

## 1. Purpose

Closes out the concrete items in `ROADMAP.md` toward a releasable engine/demo state (engine polish, per the user's stated priority — a live world deploy is a later milestone). Scope was narrowed from ROADMAP's 4 raw bullets through discussion:

- "Remove legend info on mobile, or add very minimal" → shrink the footer legend on mobile (Section 2).
- "Settings positioned on corner left or right, decide" → already resolved (inline in the filters panel); just remove the stale ROADMAP line.
- "Add geojson of border regions" → left open, not part of this work — undecided (Tenerife-first vs all-Spain, authored vs OSM-sourced), and doesn't need time/calendar.
- "Improve calendar time on Map in Filter view" → turned out to be the same underlying gap as border regions' "temporal won't be used" note: `systems.time` already exists in the manifest schema/type and validates, but nothing reads it. Wiring it up to actually hide the Time UI for a world with no temporal data (Section 3) serves both.

`feature-request-world-def.md`'s remaining sub-projects (rule system, API data-source loader, `systems`/`calendar.available` schema extension beyond what's here) are explicitly deferred — no current world needs them (YAGNI), not part of this release.

## 2. Mobile footer legend

`.map-footer-legend` (`src/styles.css`, currently ~line 1620) shows date + scale bar + attribution as one row, `position: fixed`, unconditionally. Below this codebase's one consistent mobile/desktop breakpoint (`48rem`, used throughout `styles.css` for every other mobile/desktop split), `.map-scale` and `.data-attribution` are hidden — only `.map-date-text` remains visible. At `48rem` and above, unchanged (all three visible, current behavior).

CSS-only: default (mobile-first) rules hide `.map-scale`/`.data-attribution` inside `.map-footer-legend`; a `@media (min-width: 48rem)` block restores `display: flex`/`display: block` (whatever their current display value is) for both.

## 3. `systems.time: false` gating

`AppManifest.systems?.time` (`src/engine/manifests/app-manifest.ts`) is validated (must be boolean if present) but never read anywhere. This wires it up: when a world sets it to `false`, three UI elements become entirely unreachable (not just visually hidden while still interactive) —

- Filters panel's "Time" section (`#panel-right-time`, `CalendarBar.ts`'s mount point) and its granularity stepper/date fields/range slider.
- The Map/Calendar view switcher pill (`#view-switcher`) — with it gone, `AppState.view` can never become `'calendar'` (no other code path sets it), so Calendar view is unreachable, not merely hidden mid-render.
- Settings popover's calendar-system row (`SettingsControl.ts`'s "Calendar" section: the Gregorian/Julian/Islamic/Hebrew `<select>`).

**Mechanism:**

- `main.ts`'s `bootstrap()`, right after `appManifest` validates: `document.querySelector('#app')!.classList.toggle('no-time', appManifest.systems?.time === false)`. Undefined or `true` both mean time stays enabled (matches the existing validation, which treats the field as fully optional) — only an explicit `false` disables it.
- `src/styles.css`: `.map-app.no-time #view-switcher`, `.map-app.no-time #panel-right-time`, and `.map-app.no-time #calendar-view` all get `display: none`. The `panel__section-separator` immediately before `#panel-right-time` (`index.html` has one on each side of it, sandwiching it between the filters section and the settings row) also needs to disappear, or a closed double-separator gap remains — `.map-app.no-time .panel__section-separator:has(+ #panel-right-time) { display: none; }`.
- `SettingsControl.ts`'s `mountSettingsControl` gains a `timeEnabled = deps.appManifest.systems?.time !== false` local; the `<p class="settings-control-group__title">Calendar</p>` + calendar-system `<label>` row are omitted from the template string entirely when `!timeEnabled` (not just hidden — no dead `<select>` left in the DOM). The `systemSelect` variable/its `querySelector` and the `change` listener wiring after it are skipped in that case (guarded by the same `timeEnabled` check) since the element won't exist.
- `worlds/paranormal-espana/world.json` gains `"systems": { "time": false }` — the concrete case that motivated this.
- `docs/schemas/world.schema.json` gains a `systems` property (currently absent — `additionalProperties: false` at the schema root means a manifest setting `systems` today fails editor-side schema validation even though the runtime validator already accepts it): `{ "type": "object", "additionalProperties": false, "properties": { "time": { "type": "boolean" } } }`.
- `docs/json-reference.md` gains a `systems.time` row in the `world.json` field table.

**Not in scope:** `AppState.selectedDate`/`calendarSystem` and the temporal-filtering engine machinery (`isActiveOn`, etc.) stay exactly as they are — a `no-time` world still has a (unused, hidden) `selectedDate` internally, since removing it would ripple through the store/engine for no behavioral benefit. `calendar.min`/`calendar.max`/`default` remain required fields on every `world.json` regardless of `systems.time` (unchanged validation) — `paranormal-espana/world.json` already has them.

## 4. ROADMAP.md rewrite

After this ships:

- Remove the "Settings positioned..." line (resolved).
- Remove "improve calendar time on Map in Filter view" (resolved via Section 3).
- Reword "Add geojson of border regions" to capture the actual open decision: which regions (Tenerife-only now, all-Spain later), and authored-geojson vs OSM-sourced — explicitly not blocked on temporal/calendar support.
- Keep the `feature-request-world-def.md` link and the "future massive refactor to own Map Server and PostgreSQL" heading as-is (both already correctly framed as deferred).

## 5. Testing

- Footer legend: manual verification via dev server + Playwright at a mobile viewport (same method as the last mobile-layout fix) — confirm only the date shows below 48rem, full strip at 48rem+.
- `systems.time` gating: manual verification the same way, loading `?world=paranormal-espana` (once its `world.json` is updated) and confirming no Time section, no view switcher, no calendar-system row in Settings — then `?world=demo` unchanged (all three present, since `demo/world.json` has no `systems` field).
- No new automated tests: none of the touched files (`styles.css`, `SettingsControl.ts`, `main.ts`'s bootstrap wiring) have an existing test file, and this project's Vitest environment is `node` (no DOM), consistent with how `applyBranding`/`app-chrome.ts` wiring was verified in prior work.
- `npx tsc --noEmit` and `npx vitest run` stay green (no behavior in tested modules changes).
