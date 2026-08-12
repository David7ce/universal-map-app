# Left panel (search) collapse behavior + cohesion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left panel (`SearchOverlay.ts`, `#search-overlay`) behave the same way — collapsed by default, opens on demand — on both mobile and desktop, wire the right panel's day-picker to open it, add a result count, and fix a desktop-only visual bug where the info/day-agenda states render with no card background.

**Architecture:** No new state, no new files. `store.panels.left` already fully describes open/closed; the only bug is a desktop `@media` block in `styles.css` overriding the `hidden` attribute regardless of that state. Fix is: delete the override, add matching desktop card styling for the two content states that never needed it before (info/day-agenda), wire one more `openPanel` call site (`CalendarBar.ts`'s day-pick), add a count string, and delete one now-dead branch in `SearchOverlay.ts`'s Escape handler.

**Tech Stack:** TypeScript, vanilla DOM (`innerHTML` + `querySelector`, no framework), plain CSS with custom properties. No test framework touches this file (DOM-only UI, consistent with `CalendarView.ts`/`CalendarGrid.ts` precedent — verified manually via dev server + Playwright, not unit tests).

## Global Constraints

- No jsdom in this project — do not add DOM-level unit tests for `SearchOverlay.ts`/`CalendarBar.ts`; verify manually via Playwright against `npx vite`, per every prior UI task this session.
- `t(key, strings, params)` interpolates single-brace placeholders (`{count}`, not `{{count}}` — confirmed in `src/ui/strings.ts`: `/\{(\w+)\}/g`).
- Every string key added must go in all 4 worlds' `strings.json` (`worlds/demo/`, `worlds/events-canary-islands/`, `worlds/moon-map-photos/`, `worlds/paranormal-spain/`) — same key, same English value (existing `search.*` keys are English even in the Spanish-content worlds).
- Full verification gate before considering any task done: `npx tsc --noEmit`, `npx vitest run`, `npx eslint .`, `npx prettier --check .` all clean (prettier auto-fix with `--write` if it flags formatting).
- Dev server for manual verification: `npx vite --port <free-port>`, then Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_console_messages`, `browser_take_screenshot`) — check console errors after every interaction. Delete any scratch screenshots from `.playwright-mcp/` afterward. Stop the dev server when done (find its PID via `netstat -ano | grep ":<port> "` then `powershell -Command "Stop-Process -Id <pid> -Force"`).

---

### Task 1: Wire day-pick in the right panel to open the left panel

**Files:**
- Modify: `src/ui/panels/CalendarBar.ts:1` (imports), `src/ui/panels/CalendarBar.ts:177-179` (`selectDay`)

**Interfaces:**
- Consumes: `openPanel(store: Store<AppState>, which: 'left' | 'right'): void` — already exported from `src/engine/state/store.ts:31`, already imported and used in `src/ui/panels/SearchOverlay.ts:2`.
- Produces: nothing new consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Add the import**

In `src/ui/panels/CalendarBar.ts`, current line 1:

```ts
import type { Store, AppState } from '../../engine/state/store';
```

Change to:

```ts
import type { Store, AppState } from '../../engine/state/store';
import { openPanel } from '../../engine/state/store';
```

- [ ] **Step 2: Call `openPanel` from `selectDay`**

Current (`src/ui/panels/CalendarBar.ts:177-179`):

```ts
  function selectDay(iso: string): void {
    store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
  }
```

Replace with:

```ts
  function selectDay(iso: string): void {
    store.set({ selectedDate: clampDateToRange(iso, config.min, maxIso) });
    // Picking a day here should actually surface its agenda, not just
    // update a panel the user may not have open — SearchOverlay.ts's day
    // agenda is the only place a day's events render.
    openPanel(store, 'left');
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panels/CalendarBar.ts
git commit -m "feat: picking a day in the right panel opens the left panel's day agenda"
```

---

### Task 2: Unify left panel open/closed behavior across breakpoints

**Files:**
- Modify: `src/styles.css:362-405` (the `@media (min-width: 64rem)` block)

**Interfaces:**
- Consumes: existing `.map-search[hidden]` base rule (`display: none`, already present earlier in the file, unmodified), existing `.control-btn--search[aria-expanded='true'] { display: none; }` rule (unmodified) — both currently overridden by this media block, both correct once the override is gone.
- Produces: nothing consumed by later tasks (CSS-only; Task 3's Escape-handler cleanup depends on this behavior change being in place first, so do this task before Task 3).

- [ ] **Step 1: Delete the three overriding rules**

In `src/styles.css`, inside the `@media (min-width: 64rem) { ... }` block that starts at line 362, delete these three rule blocks (keep everything else in the block — positioning, backdrop removal, search-field/results styling):

```css
  /* Desktop: the search field is always visible, docked top-left — no
     circular toggle button, and no `hidden` state to fight with. */
  .control-btn--search {
    display: none;
  }
  .map-search[hidden] {
    display: block;
  }
```

and

```css
  .map-search__close {
    display: none;
  }
```

Replace the removed comment with one that reflects the new reality — the block immediately after (`.map-search { position: fixed; ... }`) should now be preceded by:

```css
  /* Desktop: same open/closed behavior as mobile (driven by
     store.panels.left, see SearchOverlay.ts), just docked top-left as a
     compact anchored panel instead of a full-screen modal — no backdrop,
     no toggle-button hiding, no forced-visible override. */
```

The block should read, in full, after this change:

```css
@media (min-width: 64rem) {
  /* Desktop: same open/closed behavior as mobile (driven by
     store.panels.left, see SearchOverlay.ts), just docked top-left as a
     compact anchored panel instead of a full-screen modal — no backdrop,
     no toggle-button hiding, no forced-visible override. */
  .map-search {
    position: fixed;
    inset: auto;
    top: var(--control-btn-offset);
    left: var(--control-btn-offset);
    width: min(22rem, calc(100vw - 2 * var(--control-btn-offset)));
  }
  .map-search__backdrop {
    display: none;
  }
  .map-search__panel {
    margin: 0;
    padding: 0;
    max-height: none;
    overflow: visible;
    gap: 0;
    background: transparent;
    box-shadow: none;
  }
  .search-field {
    background-color: var(--color-white);
    box-shadow: var(--shadow-md);
  }
  .search-results,
  .search-info,
  .search-day-agenda {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    max-height: calc(100vh - 8rem);
    background: var(--color-white);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }
}
```

(The last rule replaces the old `.search-results { ... }`-only block — `.search-info`/`.search-day-agenda` need the exact same floating-card treatment now that `.map-search__panel` is transparent at this breakpoint. Before this change they had no background of their own at desktop, so the info/day-agenda states would have rendered as unstyled text floating directly over the map — a pre-existing bug that never showed up because the day agenda didn't exist yet and the info state's transparent look went unnoticed. `search-info`/`search-day-agenda`'s own base rules already set `overflow-y: auto` and padding — the desktop-only `max-height` here still applies as expected since it's a separate property.)

- [ ] **Step 2: Verify CSS is well-formed**

Run: `npx prettier --check src/styles.css`
Expected: clean (or run `npx prettier --write src/styles.css` if it flags formatting, then re-check).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "fix: left panel collapses by default on desktop too, not just mobile"
```

---

### Task 3: Remove the now-dead Escape-handler branch

**Files:**
- Modify: `src/ui/panels/SearchOverlay.ts:230-245`

**Interfaces:**
- Consumes: Task 2's behavior change (the `else if` branch below was only ever reachable when the desktop override kept the panel visible with `panels.left` still `'closed'` — that state no longer exists after Task 2, so the branch is provably dead, not just unused).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Simplify the handler**

Current (`src/ui/panels/SearchOverlay.ts:230-245`):

```ts
  // Escape: if the overlay is open (mobile modal), close it and return focus
  // to the toggle. If the search field has text (desktop always-visible mode),
  // clear it. At desktop, `panels.left` stays 'closed' so only the else
  // branch fires.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (store.get().panels.left === 'open') {
      event.preventDefault();
      close();
      toggleButton.focus();
    } else if (document.activeElement === searchInput && searchInput.value && store.get().selectedFeatureId === null) {
      event.preventDefault();
      searchInput.value = '';
      runSearch();
    }
  });
```

Replace with:

```ts
  // Escape closes the panel and returns focus to the toggle — same
  // behavior at every breakpoint now that desktop no longer forces the
  // panel permanently open (the input is only reachable while open, so
  // there's no longer a "closed but focused and has text" state to handle
  // separately).
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || store.get().panels.left !== 'open') return;
    event.preventDefault();
    close();
    toggleButton.focus();
  });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`runSearch` stays used elsewhere in the file — `render()`'s else-branch still calls it — so no unused-function warning.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/panels/SearchOverlay.ts
git commit -m "refactor: drop dead Escape-handler branch from the old desktop-always-open mode"
```

---

### Task 4: Add a result count line to the search results state

**Files:**
- Modify: `src/ui/panels/SearchOverlay.ts:91-118` (`runSearch`)
- Modify: `worlds/demo/strings.json:9`, `worlds/events-canary-islands/strings.json:9`, `worlds/moon-map-photos/strings.json:9`, `worlds/paranormal-spain/strings.json:9` (each has `"search.noResults": "No results",` at line 9 — insert the new key right after it)

**Interfaces:**
- Consumes: `t(key: string, strings: Record<string,string>, params?: Record<string,string>): string` (`src/ui/strings.ts`) — single-brace placeholder syntax.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the string key to all 4 worlds**

In each of `worlds/demo/strings.json`, `worlds/events-canary-islands/strings.json`, `worlds/moon-map-photos/strings.json`, `worlds/paranormal-spain/strings.json`, change:

```json
  "search.noResults": "No results",
```

to:

```json
  "search.noResults": "No results",
  "search.resultCount": "{count} results",
```

- [ ] **Step 2: Render the count in `runSearch`**

Current (`src/ui/panels/SearchOverlay.ts:91-118`):

```ts
  function runSearch(): void {
    const query = searchInput.value.trim();
    syncClearButton();
    if (!query) {
      matches = [];
      resultsEl.innerHTML = '';
      resultsEl.hidden = true;
      return;
    }

    matches = searchFeatures(searchableFeatures(), query, ['name', 'title']);
    resultsEl.hidden = false;
    resultsEl.innerHTML = matches.length
      ? matches
          .map(
            (feature, index) =>
              `<button type="button" class="search-result-item" data-result-index="${index}"><span class="search-result-item__name">${escapeHtml(featureLabel(feature, strings))}</span></button>`,
          )
          .join('')
      : `<p class="search-results__empty">${t('search.noResults', strings)}</p>`;

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        selectFeature(String(feature.id ?? ''));
      });
    });
  }
```

Replace with:

```ts
  function runSearch(): void {
    const query = searchInput.value.trim();
    syncClearButton();
    if (!query) {
      matches = [];
      resultsEl.innerHTML = '';
      resultsEl.hidden = true;
      return;
    }

    matches = searchFeatures(searchableFeatures(), query, ['name', 'title']);
    resultsEl.hidden = false;
    const countLine = matches.length
      ? `<p class="search-results__count">${escapeHtml(t('search.resultCount', strings, { count: String(matches.length) }))}</p>`
      : '';
    resultsEl.innerHTML =
      countLine +
      (matches.length
        ? matches
            .map(
              (feature, index) =>
                `<button type="button" class="search-result-item" data-result-index="${index}"><span class="search-result-item__name">${escapeHtml(featureLabel(feature, strings))}</span></button>`,
            )
            .join('')
        : `<p class="search-results__empty">${t('search.noResults', strings)}</p>`);

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        selectFeature(String(feature.id ?? ''));
      });
    });
  }
```

- [ ] **Step 3: Add CSS for the count line**

In `src/styles.css`, immediately after the existing `.search-results__empty` rule (currently right after `.search-result-item__name`, before the `@media (min-width: 64rem)` block), add:

```css
.search-results__count {
  padding: 0.5rem 0.75rem 0;
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
}
```

- [ ] **Step 4: Typecheck and format check**

Run: `npx tsc --noEmit && npx prettier --check src/ui/panels/SearchOverlay.ts src/styles.css worlds/demo/strings.json worlds/events-canary-islands/strings.json worlds/moon-map-photos/strings.json worlds/paranormal-spain/strings.json`
Expected: no errors; prettier clean (run with `--write` on any flagged file, then re-check).

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/SearchOverlay.ts src/styles.css worlds/demo/strings.json worlds/events-canary-islands/strings.json worlds/moon-map-photos/strings.json worlds/paranormal-spain/strings.json
git commit -m "feat: show a result count above search results"
```

---

### Task 5: Make the day agenda list visually match the search results list

**Files:**
- Modify: `src/styles.css:1054-1105` (the `SEARCH DAY AGENDA` block)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Restyle the list as one bordered/divided container, matching `.search-results__list`/`.search-result-item`**

Current (`src/styles.css:1054-1105`):

```css
.search-day-agenda {
  overflow-y: auto;
  min-height: 0;
  padding: 0.75rem 0.9rem;
}
.search-day-agenda[hidden] {
  display: none;
}
.search-day-agenda__date {
  margin: 0 0 0.5rem;
  font-weight: var(--font-weight-semibold);
}
.search-day-agenda__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.search-day-agenda__item-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  cursor: pointer;
  font: inherit;
}
.search-day-agenda__item-btn:hover {
  background-color: var(--color-bg-alt);
}
.search-day-agenda__item-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.search-day-agenda__item-layer {
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
  text-transform: uppercase;
}
.search-day-agenda__item-name {
  font-weight: var(--font-weight-medium);
}
.search-day-agenda__empty {
  color: var(--color-text-light);
}
```

Replace with (same class names, same markup in `SearchOverlay.ts` — no TS changes needed; only the container/item box-model changes, matching `.search-results`/`.search-result-item`'s bordered-container-with-divided-rows pattern instead of separate floating cards):

```css
.search-day-agenda {
  overflow-y: auto;
  min-height: 0;
  padding: 0.75rem 0.9rem;
}
.search-day-agenda[hidden] {
  display: none;
}
.search-day-agenda__date {
  margin: 0 0 0.5rem;
  font-weight: var(--font-weight-semibold);
}
.search-day-agenda__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.search-day-agenda__item-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.search-day-agenda__item:last-child .search-day-agenda__item-btn {
  border-bottom: none;
}
.search-day-agenda__item-btn:hover {
  background-color: var(--color-bg-alt);
}
.search-day-agenda__item-btn:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  background-color: var(--color-primary-light);
}
.search-day-agenda__item-layer {
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
  text-transform: uppercase;
}
.search-day-agenda__item-name {
  font-weight: var(--font-weight-medium);
}
.search-day-agenda__empty {
  color: var(--color-text-light);
}
```

- [ ] **Step 2: Format check**

Run: `npx prettier --check src/styles.css`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: make the day agenda list match the search results list styling"
```

---

### Task 6: Full verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: all of Tasks 1-5.
- Produces: nothing (terminal task).

- [ ] **Step 1: Run the full automated gate**

Run, in order:
- `npx vitest run` — expect all tests pass (no test changes in this plan, so the count should match whatever it was before this plan started).
- `npx tsc --noEmit` — expect no errors.
- `npx eslint .` — expect no errors.
- `npx prettier --check .` — expect clean; if it flags files, run `npx prettier --write .` and re-check.

- [ ] **Step 2: Manual verification via dev server (desktop viewport)**

Start `npx vite --port 5210` (or any free port), then use the Playwright tools against `http://localhost:5210/?world=events-canary-islands` (has real dated events and no `systems.time: false`):

1. Take a snapshot. Confirm the left panel is collapsed (only the search toggle icon visible, no search field/results visible) and the right panel's month grid is visible after entering the map (click "See what's on" first).
2. Click the search toggle icon. Confirm the panel opens showing the day agenda for the current `selectedDate` (a date heading + either event items or the "no events" message), styled as a white card with a shadow, not floating unstyled text.
3. Type a query that matches at least one event (e.g. a word from one of `events-canary-islands`'s event names). Confirm results appear with a "N results" count line above them, and the day agenda is hidden.
4. Clear the query (click the clear button). Confirm it reverts to showing the day agenda again.
5. Click a search result. Confirm it shows the feature info card (also a proper white card, not unstyled text) and the panel stays open.
6. Close the panel (click the toggle icon again, now acting as close). Confirm it collapses back to just the icon.
7. Reopen it, then in the right panel's month grid click a day with at least one event. Confirm the left panel opens automatically showing that day's agenda with the event listed, and a "View" interaction (clicking the agenda item) selects that feature.
8. Check `browser_console_messages` (level "error") after each step above — expect zero.
9. Take one screenshot for your own confirmation, then delete it from `.playwright-mcp/` — do not leave scratch screenshots in the repo.

- [ ] **Step 3: Manual verification via dev server (mobile viewport)**

Using the same running dev server, resize the Playwright browser to a mobile width (e.g. `browser_resize` to 390x844 if available, or navigate with a mobile user-agent context) and repeat steps 1-6 above. Confirm the panel now renders as the existing full-screen modal with backdrop (unchanged mobile behavior) rather than the desktop docked dropdown, and that open/closed timing matches desktop (collapsed by default, opens on the same triggers). Zero console errors.

- [ ] **Step 4: Stop the dev server**

Find its PID (`netstat -ano | grep ":5210 " | grep LISTENING` on Windows via the Bash tool) and stop it (`powershell -Command "Stop-Process -Id <pid> -Force"`).

- [ ] **Step 5: Final commit if any cleanup was needed**

If Step 1's `prettier --write` or any fix during manual verification touched files, stage and commit them with a message describing what was fixed. If nothing needed fixing, this step is a no-op — the plan is done.
