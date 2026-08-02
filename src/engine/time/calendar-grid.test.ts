import { beforeAll, describe, expect, it } from 'vitest';
import { buildMonthCells, buildWeekCells, buildYearCells } from './calendar-grid';
import { daysInCalendarMonth, ensureCalendarSystemLoaded, monthsInCalendarYear } from './calendar-conversion';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import type { LayerManifest } from '../manifests/layer-manifest';

function layerWithEventOn(iso: string): LoadedLayer {
  const manifest: LayerManifest = {
    id: 'poi',
    title: 'POI',
    kind: 'point',
    source: { type: 'geojson', url: '/x' },
  };
  return {
    manifest,
    features: [
      {
        type: 'Feature',
        id: '1',
        properties: { temporal: { instant: iso } },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ],
  };
}

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
  await ensureCalendarSystemLoaded('hebrew');
});

describe('buildWeekCells', () => {
  it('returns the Sunday-start week containing the selected date, gregorian', () => {
    const cells = buildWeekCells('2026-07-29', 'gregorian', [], {});
    expect(cells.map((c) => c.iso)).toEqual([
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ]);
  });

  it('marks hasEvents true only on the cell matching an active feature', () => {
    const cells = buildWeekCells('2026-07-29', 'gregorian', [layerWithEventOn('2026-07-30')], {});
    expect(cells.find((c) => c.iso === '2026-07-30')!.hasEvents).toBe(true);
    expect(cells.find((c) => c.iso === '2026-07-29')!.hasEvents).toBe(false);
  });

  it('respects activeFilters when computing hasEvents', () => {
    const layer = layerWithEventOn('2026-07-30');
    layer.manifest = {
      ...layer.manifest,
      taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
    };
    layer.features[0].properties.category = 'shop';
    const cells = buildWeekCells('2026-07-29', 'gregorian', [layer], { category: new Set(['market']) });
    expect(cells.find((c) => c.iso === '2026-07-30')!.hasEvents).toBe(false);
  });
});

describe('buildMonthCells', () => {
  it('has no leading blanks and 28 in-period cells for February 2026 (starts Sunday, not a leap year)', () => {
    const cells = buildMonthCells('2026-02-15', 'gregorian', [], {});
    expect(cells.length).toBe(28);
    expect(cells.every((c) => c.inCurrentPeriod)).toBe(true);
    expect(cells[0].iso).toBe('2026-02-01');
    expect(cells[27].iso).toBe('2026-02-28');
  });

  it('has 4 leading and 2 trailing blanks for February 2024 (starts Thursday, leap year)', () => {
    const cells = buildMonthCells('2024-02-15', 'gregorian', [], {});
    expect(cells.length).toBe(35);
    expect(cells.filter((c) => !c.inCurrentPeriod).length).toBe(6);
    expect(cells.filter((c) => c.inCurrentPeriod).length).toBe(29);
    expect(cells[4].iso).toBe('2024-02-01');
    expect(cells[4].inCurrentPeriod).toBe(true);
  });

  it('cell count matches daysInCalendarMonth for a non-gregorian system, rounded up to a full week', () => {
    // toCalendarParts('2026-07-29', 'islamic') is { year: 1448, month: 2, ... } (see calendar-conversion.test.ts).
    const cells = buildMonthCells('2026-07-29', 'islamic', [], {});
    const inPeriod = cells.filter((c) => c.inCurrentPeriod);
    expect(inPeriod.length).toBe(daysInCalendarMonth(1448, 2, 'islamic'));
    expect(cells.length % 7).toBe(0);
  });

  it('blank cells never report hasEvents even if a feature is active that day', () => {
    const cells = buildMonthCells('2024-02-15', 'gregorian', [layerWithEventOn('2024-01-30')], {});
    expect(cells.filter((c) => !c.inCurrentPeriod).every((c) => c.hasEvents === false)).toBe(true);
  });
});

describe('buildYearCells', () => {
  it('returns 12 cells for gregorian, months 1-12 in order', () => {
    const cells = buildYearCells('2026-07-29', 'gregorian', [], {});
    expect(cells.length).toBe(12);
    expect(cells.map((c) => c.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('cell count matches monthsInCalendarYear for hebrew (12 or 13)', () => {
    const cells = buildYearCells('2026-07-29', 'hebrew', [], {});
    expect(cells.length).toBe(monthsInCalendarYear(5786, 'hebrew'));
  });

  it('marks hasEvents true for a month containing an active feature, false for others', () => {
    const cells = buildYearCells('2026-01-15', 'gregorian', [layerWithEventOn('2026-03-10')], {});
    expect(cells.find((c) => c.month === 3)!.hasEvents).toBe(true);
    expect(cells.find((c) => c.month === 1)!.hasEvents).toBe(false);
  });
});
