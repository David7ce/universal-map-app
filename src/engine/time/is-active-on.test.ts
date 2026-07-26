import { describe, expect, it } from 'vitest';
import { isActiveOn } from './is-active-on';
import type { GeoFeature, Temporal } from './temporal-types';

function feature(temporal?: Temporal): GeoFeature {
  return {
    type: 'Feature',
    id: 'f1',
    properties: { temporal },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
}

describe('isActiveOn', () => {
  it('is always active when temporal is absent', () => {
    expect(isActiveOn(feature(undefined), new Date('2026-01-01T00:00:00Z'))).toBe(true);
  });

  it('matches an instant exactly', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(isActiveOn(f, new Date('2026-03-14T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:00Z'))).toBe(false);
  });

  it('respects an open-ended range', () => {
    const f = feature({ range: { from: '2020-01-01' } });
    expect(isActiveOn(f, new Date('2019-12-31T00:00:00Z'))).toBe(false);
    expect(isActiveOn(f, new Date('2020-01-01T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2099-01-01T00:00:00Z'))).toBe(true);
  });

  it('respects a bounded range', () => {
    const f = feature({ range: { from: '2018-01-01', to: '2023-06-30' } });
    expect(isActiveOn(f, new Date('2023-06-30T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2023-07-01T00:00:00Z'))).toBe(false);
  });

  it('resolves recurrence using range.from as the anchor', () => {
    const f = feature({
      range: { from: '2026-03-01', to: '2026-12-31' },
      recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU' },
    });
    expect(isActiveOn(f, new Date('2026-03-08T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-09T00:00:00Z'))).toBe(false);
    expect(isActiveOn(f, new Date('2026-02-01T00:00:00Z'))).toBe(false);
  });

  it('skips exception dates', () => {
    const f = feature({
      range: { from: '2026-03-01' },
      recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU', exceptions: ['2026-03-08'] },
    });
    expect(isActiveOn(f, new Date('2026-03-01T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-08T00:00:00Z'))).toBe(false);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:00Z'))).toBe(true);
  });

  it('gives instant precedence over range/recurrence if both are present', () => {
    const f = feature({ instant: '2026-03-14', range: { from: '2020-01-01' } });
    expect(isActiveOn(f, new Date('2026-03-14T00:00:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:00Z'))).toBe(false);
  });

  it('normalizes non-midnight instant date to day boundary', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(isActiveOn(f, new Date('2026-03-14T13:45:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-14T23:59:59Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2026-03-15T00:00:01Z'))).toBe(false);
  });

  it('normalizes non-midnight range.to boundary to include the entire day', () => {
    const f = feature({ range: { from: '2018-01-01', to: '2023-06-30' } });
    expect(isActiveOn(f, new Date('2023-06-30T13:45:00Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2023-06-30T23:59:59Z'))).toBe(true);
    expect(isActiveOn(f, new Date('2023-07-01T00:00:00Z'))).toBe(false);
  });
});
