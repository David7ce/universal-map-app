import type { CalendarSystem } from './calendar-systems';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import { featureMatchesFilters } from '../taxonomy/compute-dimensions';
import { isActiveOn } from './is-active-on';
import { calendarPartsToIso, daysInCalendarMonth, monthsInCalendarYear, toCalendarParts } from './calendar-conversion';

export interface CalendarGridDayCell {
  iso: string;
  day: number;
  inCurrentPeriod: boolean;
  hasEvents: boolean;
}

export interface CalendarGridMonthGroup {
  iso: string; // Gregorian ISO of day 1 of this month, in the display system
  month: number; // 1-based, display system
  cells: CalendarGridDayCell[]; // same shape buildMonthCells returns for this month
}

// Deliberately not imported from CalendarBar.ts — engine/ must not depend on
// ui/ (see CONTEXT.md). Two five-line helpers duplicated is cheaper than
// threading a shared utility module across that boundary.
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// A feature with no `properties.temporal` is always active (isActiveOn
// returns true for it on any date) — that means "always present", not "an
// event on this day". Counting it toward the grid's event dot would light
// up every single cell for any layer with untimed features (the common
// case), making the dot convey nothing. Only features tied to a specific
// date/range count as an "event" here.
function hasActiveFeatureOn(layers: LoadedLayer[], activeFilters: Record<string, Set<string>>, iso: string): boolean {
  const date = new Date(`${iso}T00:00:00Z`);
  return layers.some((layer) =>
    layer.features.some(
      (feature) =>
        feature.properties.temporal !== undefined &&
        featureMatchesFilters(feature, layer.manifest, activeFilters) &&
        isActiveOn(feature, date),
    ),
  );
}

export function buildWeekCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridDayCell[] {
  const weekStartIso = addDays(selectedIso, -weekdayOf(selectedIso));
  const cells: CalendarGridDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStartIso, i);
    cells.push({
      iso,
      day: toCalendarParts(iso, system).day,
      inCurrentPeriod: true,
      hasEvents: hasActiveFeatureOn(layers, activeFilters, iso),
    });
  }
  return cells;
}

export function buildMonthCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridDayCell[] {
  const { year, month } = toCalendarParts(selectedIso, system);
  const firstIso = calendarPartsToIso({ year, month, day: 1 }, system);
  const leadingBlanks = weekdayOf(firstIso);
  const dayCount = daysInCalendarMonth(year, month, system);

  const cells: CalendarGridDayCell[] = [];
  for (let i = leadingBlanks; i > 0; i--) {
    const iso = addDays(firstIso, -i);
    cells.push({ iso, day: toCalendarParts(iso, system).day, inCurrentPeriod: false, hasEvents: false });
  }
  for (let day = 1; day <= dayCount; day++) {
    const iso = calendarPartsToIso({ year, month, day }, system);
    cells.push({ iso, day, inCurrentPeriod: true, hasEvents: hasActiveFeatureOn(layers, activeFilters, iso) });
  }
  while (cells.length % 7 !== 0) {
    const iso = addDays(cells[cells.length - 1].iso, 1);
    cells.push({ iso, day: toCalendarParts(iso, system).day, inCurrentPeriod: false, hasEvents: false });
  }
  return cells;
}

// One buildMonthCells call per month in the display-system year — used by the
// full-screen Calendar view's year layout (all 12 months laid out at once,
// every day visible).
export function buildYearMonthCells(
  selectedIso: string,
  system: CalendarSystem,
  layers: LoadedLayer[],
  activeFilters: Record<string, Set<string>>,
): CalendarGridMonthGroup[] {
  const { year } = toCalendarParts(selectedIso, system);
  const monthCount = monthsInCalendarYear(year, system);
  const groups: CalendarGridMonthGroup[] = [];
  for (let month = 1; month <= monthCount; month++) {
    const iso = calendarPartsToIso({ year, month, day: 1 }, system);
    groups.push({ iso, month, cells: buildMonthCells(iso, system, layers, activeFilters) });
  }
  return groups;
}
