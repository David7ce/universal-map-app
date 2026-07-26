import { describe, expect, it } from 'vitest';
import { describeTemporalStatus } from './temporal-status';
import type { GeoFeature } from '../../engine/time/temporal-types';

function feature(temporal?: GeoFeature['properties']['temporal']): GeoFeature {
  return { type: 'Feature', id: '1', properties: { temporal }, geometry: { type: 'Point', coordinates: [0, 0] } };
}

describe('describeTemporalStatus', () => {
  it('describes a feature with no temporal data as always active', () => {
    expect(describeTemporalStatus(feature(undefined), new Date('2026-01-01T00:00:00Z'))).toBe('Always active');
  });

  it('describes an instant feature on and off its date', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'))).toBe('Active on 2026-03-14');
    expect(describeTemporalStatus(f, new Date('2026-03-15T00:00:00Z'))).toBe('Occurred on 2026-03-14');
  });

  it('describes a ranged feature', () => {
    const f = feature({ range: { from: '2020-01-01', to: '2023-06-30' } });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'))).toBe('Active (since 2020-01-01 until 2023-06-30)');
    expect(describeTemporalStatus(f, new Date('2024-01-01T00:00:00Z'))).toBe(
      'Not active on selected date (since 2020-01-01 until 2023-06-30)'
    );
  });

  it('describes a recurring feature', () => {
    const f = feature({ range: { from: '2026-03-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU' } });
    expect(describeTemporalStatus(f, new Date('2026-03-01T00:00:00Z'))).toBe(
      'Active today (recurs: FREQ=WEEKLY;BYDAY=SU)'
    );
    expect(describeTemporalStatus(f, new Date('2026-03-02T00:00:00Z'))).toBe(
      'Not active on selected date (recurs: FREQ=WEEKLY;BYDAY=SU)'
    );
  });
});
