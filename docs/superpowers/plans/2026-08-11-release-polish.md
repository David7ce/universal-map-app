# Release polish: mobile legend + systems.time gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the footer legend to just the date on mobile, and wire up the already-existing-but-unused `systems.time` manifest field so a world with no temporal data can hide the Time UI entirely (filters panel's Time section, the Map/Calendar view switcher, and Settings' calendar-system row) — then close out the corresponding `ROADMAP.md` items.

**Architecture:** Two independent, additive changes. The legend fix is pure CSS (one new breakpoint rule). The `systems.time` gating is a single boolean read once at bootstrap (`appManifest.systems?.time !== false`), applied as one CSS class (`no-time` on `.map-app`) that hides three DOM regions via CSS, plus one conditional branch in `SettingsControl.ts`'s HTML template (since that row's `<select>` must not exist in the DOM at all when disabled, not just be hidden). No engine code changes — this is UI wiring only.

**Tech Stack:** TypeScript, vanilla DOM, CSS (no new dependencies).

## Global Constraints

- No new npm dependencies.
- The one mobile/desktop breakpoint already used throughout `src/styles.css` is `@media (min-width: 48rem)` — reuse it, don't introduce a different breakpoint.
- `systems.time` undefined or `true` both mean time stays enabled (matches `validateAppManifest`, which treats the field as fully optional) — only an explicit `false` disables it.
- `AppState.selectedDate`/`calendarSystem` and the temporal-filtering engine (`isActiveOn`, etc.) are untouched — a `no-time` world still has this internally, just unused/hidden. `calendar.min`/`max`/`default` remain required on every `world.json` regardless of `systems.time`.
- None of the touched files (`styles.css`, `SettingsControl.ts`, `main.ts`) have an existing test file, and this project's Vitest environment is `node` (no DOM) — verify manually via dev server + Playwright, consistent with how prior CSS/bootstrap-wiring changes in this project were verified. `npx tsc --noEmit` and `npx vitest run` must stay green regardless (no behavior in currently-tested modules changes).

---

### Task 1: Mobile footer legend — date only below 48rem

**Files:**
- Modify: `src/styles.css` (`.map-scale` block, currently starting at line 1654; `.data-attribution` block, currently starting at line 1678; the `@media (min-width: 48rem)` block starting at line 1693)

**Interfaces:** None — pure CSS, no other task depends on this one.

- [ ] **Step 1: Hide `.map-scale` and `.data-attribution` by default (mobile-first)**

In `src/styles.css`, find the existing `.map-scale` rule:

```css
.map-scale {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
```

Change `display: flex;` to `display: none;`.

Find the existing `.data-attribution` rule:

```css
.data-attribution {
  color: var(--color-text-light);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Add `display: none;` as a new line inside this rule (anywhere in the block).

- [ ] **Step 2: Restore both at the 48rem breakpoint**

Find the existing `@media (min-width: 48rem)` block that currently only sets `--panel-right-width` (starting at line 1693):

```css
@media (min-width: 48rem) {
  :root {
    --panel-right-width: 320px;
  }
}
```

Add two new rules inside this same media block (after the existing `:root` rule, still inside the same `@media` block):

```css
  .map-scale {
    display: flex;
  }
  .data-attribution {
    display: block;
  }
```

The full block becomes:

```css
@media (min-width: 48rem) {
  :root {
    --panel-right-width: 320px;
  }
  .map-scale {
    display: flex;
  }
  .data-attribution {
    display: block;
  }
}
```

- [ ] **Step 3: Verify with the dev server at a mobile viewport**

Run `npm run dev`, then in a Playwright browser session:

```
resize to 390x844
navigate to http://localhost:<port>/
```

Confirm only the date text is visible in the bottom-right footer strip (no scale bar, no attribution text). Then resize to `900x800` (above 48rem = 900px vs the 48rem≈768px threshold) and confirm the scale bar and attribution both reappear alongside the date, matching current desktop behavior exactly.

- [ ] **Step 4: Run the full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors (this task touches no `.ts` file, so this step is a sanity check that nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "fix: shrink footer legend to date-only on mobile"
```

---

### Task 2: `systems.time: false` gating

**Files:**
- Modify: `src/main.ts` (`bootstrap()`, right after `appManifest` validates — currently lines 34-35)
- Modify: `src/styles.css` (new rules, anywhere in the file's relevant section — suggest near the existing `.map-app.view-calendar` rules around line 1409, or near `.panel--right`'s section)
- Modify: `src/ui/panels/SettingsControl.ts` (the whole file — template string and `render()`)
- Modify: `worlds/paranormal-espana/world.json`
- Modify: `docs/schemas/world.schema.json`
- Modify: `docs/json-reference.md`

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces: nothing consumed by a later task — this plan has no Task 3 code dependency (Task 3 only edits `ROADMAP.md` prose).

- [ ] **Step 1: Toggle a `no-time` class at bootstrap**

In `src/main.ts`, immediately after the existing line

```typescript
  applyBranding(appManifest, appId);
```

(inside `bootstrap()`, currently line 35) add:

```typescript
  document.querySelector('#app')!.classList.toggle('no-time', appManifest.systems?.time === false);
```

- [ ] **Step 2: Add the CSS that hides the three regions**

In `src/styles.css`, add this new rule block (a good location is right after the existing `.map-app.view-calendar` block, currently ending around line 1420 — keep it near the other `.map-app.*` state-class rules for discoverability):

```css
/* `systems.time: false` in world.json (e.g. a world with no temporal data,
   like paranormal-espana) hides the Time UI entirely — not just visually,
   these become unreachable: with #view-switcher gone, AppState.view can
   never become 'calendar' since no other code path sets it. */
.map-app.no-time #view-switcher,
.map-app.no-time #panel-right-time,
.map-app.no-time #calendar-view {
  display: none;
}
/* #panel-right-time is sandwiched between two .panel__section-separator
   elements (filters section above, settings row below) — hide the one
   immediately before it too, or a double-separator gap remains. */
.map-app.no-time .panel__section-separator:has(+ #panel-right-time) {
  display: none;
}
```

- [ ] **Step 3: Make `SettingsControl.ts` omit the calendar-system row when time is disabled**

Read the current file first — `src/ui/panels/SettingsControl.ts`. Add a `timeEnabled` local right after the existing `systemOptions`/`crsOptions` computation (before the `container.innerHTML = ...` template), and use it to conditionally include the calendar section:

Replace:

```typescript
  container.innerHTML = `
    <button type="button" class="settings-control-trigger" aria-expanded="false" aria-label="${t('settings.trigger', strings)}">
      ${icons.settings}
      <span class="settings-control-trigger__label">${t('settings.trigger', strings)}</span>
    </button>
    <section class="settings-control-popover" hidden>
      <p class="settings-control-group__title">${t('settings.calendarSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.calendarSystemLabel', strings)}</span>
        <select data-role="calendar-system">${systemOptions}</select>
      </label>
      <p class="settings-control-group__title">${t('settings.mapSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.projectionLabel', strings)}</span>
        <select data-role="projection">${crsOptions}</select>
      </label>
      <label class="settings-control-row">
        <span>${t('settings.gridLabel', strings)}</span>
        <input type="checkbox" data-role="grid-toggle" />
      </label>
    </section>
  `;
```

with:

```typescript
  const timeEnabled = deps.appManifest.systems?.time !== false;

  const calendarSection = timeEnabled
    ? `<p class="settings-control-group__title">${t('settings.calendarSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.calendarSystemLabel', strings)}</span>
        <select data-role="calendar-system">${systemOptions}</select>
      </label>`
    : '';

  container.innerHTML = `
    <button type="button" class="settings-control-trigger" aria-expanded="false" aria-label="${t('settings.trigger', strings)}">
      ${icons.settings}
      <span class="settings-control-trigger__label">${t('settings.trigger', strings)}</span>
    </button>
    <section class="settings-control-popover" hidden>
      ${calendarSection}
      <p class="settings-control-group__title">${t('settings.mapSection', strings)}</p>
      <label class="settings-control-row">
        <span>${t('settings.projectionLabel', strings)}</span>
        <select data-role="projection">${crsOptions}</select>
      </label>
      <label class="settings-control-row">
        <span>${t('settings.gridLabel', strings)}</span>
        <input type="checkbox" data-role="grid-toggle" />
      </label>
    </section>
  `;
```

Next, find:

```typescript
  const systemSelect = container.querySelector<HTMLSelectElement>('[data-role="calendar-system"]')!;
```

Change the `!` non-null assertion to allow `null` (since the element won't exist when `timeEnabled` is `false`):

```typescript
  const systemSelect = container.querySelector<HTMLSelectElement>('[data-role="calendar-system"]');
```

Find the block that wires it up:

```typescript
  systemSelect.value = store.get().calendarSystem;
  systemSelect.addEventListener('change', () => {
    const system = systemSelect.value as CalendarSystem;
    ensureCalendarSystemLoaded(system)
      .then(() => store.set({ calendarSystem: system }))
      .catch((error: unknown) => console.error('Failed to load calendar system', system, error));
  });
```

Wrap it in an `if (systemSelect)` guard:

```typescript
  if (systemSelect) {
    systemSelect.value = store.get().calendarSystem;
    systemSelect.addEventListener('change', () => {
      const system = systemSelect.value as CalendarSystem;
      ensureCalendarSystemLoaded(system)
        .then(() => store.set({ calendarSystem: system }))
        .catch((error: unknown) => console.error('Failed to load calendar system', system, error));
    });
  }
```

Finally, find this line inside `render()`:

```typescript
    if (document.activeElement !== systemSelect) systemSelect.value = state.calendarSystem;
```

Replace with:

```typescript
    if (systemSelect && document.activeElement !== systemSelect) systemSelect.value = state.calendarSystem;
```

- [ ] **Step 4: Set `paranormal-espana/world.json`'s `systems.time` to `false`**

In `worlds/paranormal-espana/world.json`, add a `"systems"` field. Current file ends with:

```json
  "dataLayers": ["layers/lugares.layer.json"],
  "calendar": { "default": "today", "min": "1500-01-01", "max": "2030-12-31" }
}
```

Change to:

```json
  "dataLayers": ["layers/lugares.layer.json"],
  "calendar": { "default": "today", "min": "1500-01-01", "max": "2030-12-31" },
  "systems": { "time": false }
}
```

- [ ] **Step 5: Add `systems` to the JSON Schema**

In `docs/schemas/world.schema.json`, find the `"plugins"` property block (it's the last entry inside the top-level `"properties"` object, right before the closing of `"properties"` and the `"definitions"` section). Add a new `"systems"` property immediately after the closing `}` of `"plugins"` (add a comma after `"plugins"`'s closing brace if one isn't already there):

```json
    "systems": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "time": {
          "type": "boolean",
          "description": "Set to false to hide all time/calendar UI (filters panel's Time section, the Map/Calendar view switcher, and Settings' calendar-system row) for a world with no temporal data. Defaults to true (time UI shown) when omitted."
        }
      }
    }
```

- [ ] **Step 6: Document `systems.time` in `docs/json-reference.md`**

In `docs/json-reference.md`, find the `world.json` field table (it currently ends with the `plugins.participate` row, right before the `### BaseLayerConfig` heading). Add a new row right after the `plugins.participate` row:

```markdown
| `systems.time`                  | `boolean`                                          | no                                                                 | `false` hides all time/calendar UI (filters panel's Time section, the Map/Calendar view switcher, Settings' calendar-system row) — for a world with no temporal data. Defaults to `true` (shown) when omitted.                                                                                                                                              |
```

- [ ] **Step 7: Verify `demo` world is unaffected (dev server + Playwright)**

Run `npm run dev`. Navigate to the default URL (no `?world=` — loads `demo`). Confirm the filters panel's Time section is present, the Map/Calendar view switcher pill is visible, and Settings' popover shows the calendar-system row — i.e., nothing changed for `demo`.

- [ ] **Step 8: Verify `paranormal-espana` has the Time UI hidden (dev server + Playwright)**

Navigate to `?world=paranormal-espana`. Confirm:
- The filters panel (funnel icon) has no "Time" section — only the taxonomy filter checkboxes, Settings button, and Participate button (if configured) are visible in it.
- No Map/Calendar view switcher pill appears at the top of the screen.
- Settings popover (gear icon inside the filters panel) shows only "Map" section content (projection selector, grid toggle) — no "Calendar" section, no calendar-system `<select>`.

Also check the browser console for errors (`mcp__plugin_playwright_playwright__browser_console_messages`) — confirm zero errors, since `SettingsControl.ts`'s `systemSelect` is now nullable and every use must be guarded correctly.

- [ ] **Step 9: Run the full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors (particularly confirms the `systemSelect` nullability change type-checks correctly throughout `SettingsControl.ts`).

- [ ] **Step 10: Commit**

```bash
git add src/main.ts src/styles.css src/ui/panels/SettingsControl.ts worlds/paranormal-espana/world.json docs/schemas/world.schema.json docs/json-reference.md
git commit -m "feat: wire up systems.time to hide Time UI for worlds with no temporal data"
```

---

### Task 3: `ROADMAP.md` cleanup

**Files:**
- Modify: `ROADMAP.md`

**Interfaces:** None.

- [ ] **Step 1: Rewrite the resolved/open items**

Read the current `ROADMAP.md` first (it may have accumulated further unrelated edits since this plan was written — only touch the lines described below, leave everything else as-is).

Remove the line:

```
- Settings positioned on corener left or right decide
```

(resolved — Settings is already inline in the filters panel, confirmed correct as-is; Task 1/2 of this plan didn't need to move it).

Remove the line:

```
- improve calendar time on Map in Filter view
```

(resolved by Task 2 of this plan — `systems.time: false` now hides the Time UI entirely for a world that doesn't need it).

Replace the line:

```
- Add geojson of border regions
```

with:

```
- Border regions for paranormal-espana: undecided yet — Tenerife-only for now (expanding to all of Spain later), and whether to author boundary geojson by hand or pull region shapes from OpenStreetMap directly. Doesn't need `systems.time` (this world already has it disabled) — a `regionRole: "boundary"` layer works independently of temporal/calendar support.
```

- [ ] **Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: close out resolved ROADMAP items, clarify border-regions decision"
```
