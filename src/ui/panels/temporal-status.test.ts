import { describe, expect, it } from 'vitest';
import { describeTemporalStatus } from './temporal-status';
import type { GeoFeature } from '../../engine/time/temporal-types';

function feature(temporal?: GeoFeature['properties']['temporal']): GeoFeature {
  return { type: 'Feature', id: '1', properties: { temporal }, geometry: { type: 'Point', coordinates: [0, 0] } };
}

const enStrings: Record<string, string> = {
  'temporalStatus.alwaysActive': 'Always active',
  'temporalStatus.activeOn': 'Active on {date}',
  'temporalStatus.occurredOn': 'Occurred on {date}',
  'temporalStatus.activeToday': 'Active today',
  'temporalStatus.notActiveOnSelectedDate': 'Not active on selected date',
  'temporalStatus.recurs': 'recurs: {rule}',
  'temporalStatus.active': 'Active',
  'temporalStatus.notActive': 'Not active',
  'temporalStatus.since': 'since {date}',
  'temporalStatus.until': 'until {date}',
};

describe('describeTemporalStatus', () => {
  it('describes a feature with no temporal data as always active', () => {
    expect(describeTemporalStatus(feature(undefined), new Date('2026-01-01T00:00:00Z'), enStrings)).toBe(
      'Always active',
    );
  });

  it('describes an instant feature on and off its date', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), enStrings)).toBe('Active on 2026-03-14');
    expect(describeTemporalStatus(f, new Date('2026-03-15T00:00:00Z'), enStrings)).toBe('Occurred on 2026-03-14');
  });

  it('describes a ranged feature', () => {
    const f = feature({ range: { from: '2020-01-01', to: '2023-06-30' } });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'), enStrings)).toBe(
      'Active (since 2020-01-01 until 2023-06-30)',
    );
    expect(describeTemporalStatus(f, new Date('2024-01-01T00:00:00Z'), enStrings)).toBe(
      'Not active on selected date (since 2020-01-01 until 2023-06-30)',
    );
  });

  it('describes a ranged feature with only a since bound', () => {
    const f = feature({ range: { from: '2020-01-01' } });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'), enStrings)).toBe('Active (since 2020-01-01)');
  });

  it('describes a ranged feature with only an until bound', () => {
    const f = feature({ range: { to: '2023-06-30' } });
    expect(describeTemporalStatus(f, new Date('2024-01-01T00:00:00Z'), enStrings)).toBe(
      'Not active on selected date (until 2023-06-30)',
    );
  });

  it('describes a ranged feature with neither bound', () => {
    const f = feature({ range: {} });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'), enStrings)).toBe('Active');
  });

  it('describes a recurring feature', () => {
    const f = feature({ range: { from: '2026-03-01' }, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=SU' } });
    expect(describeTemporalStatus(f, new Date('2026-03-01T00:00:00Z'), enStrings)).toBe(
      'Active today (recurs: FREQ=WEEKLY;BYDAY=SU)',
    );
    expect(describeTemporalStatus(f, new Date('2026-03-02T00:00:00Z'), enStrings)).toBe(
      'Not active on selected date (recurs: FREQ=WEEKLY;BYDAY=SU)',
    );
  });

  it('describes a bare active/not-active fallback when temporal data has no recognized shape', () => {
    const f = feature({});
    expect(describeTemporalStatus(f, new Date('2026-01-01T00:00:00Z'), enStrings)).toBe('Active');
  });

  it('falls back to raw keys when no strings map is provided', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), {})).toBe('temporalStatus.activeOn');
  });

  it('routes through translated strings with interpolation (proves the i18n fix)', () => {
    const esStrings: Record<string, string> = {
      'temporalStatus.activeOn': 'Activo el {date}',
      'temporalStatus.occurredOn': 'Ocurrió el {date}',
    };
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), esStrings)).toBe('Activo el 2026-03-14');
    expect(describeTemporalStatus(f, new Date('2026-03-15T00:00:00Z'), esStrings)).toBe('Ocurrió el 2026-03-14');
  });

  it('formats an instant date in a non-gregorian calendar system when provided', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), enStrings, 'julian')).toBe(
      'Active on March 1, 2026',
    );
  });

  it('formats range bounds in a non-gregorian calendar system when provided', () => {
    const f = feature({ range: { from: '2020-01-01', to: '2023-06-30' } });
    expect(describeTemporalStatus(f, new Date('2021-01-01T00:00:00Z'), enStrings, 'julian')).toBe(
      'Active (since December 19, 2019 until June 17, 2023)',
    );
  });

  it('defaults to gregorian (raw ISO strings) when no system is given', () => {
    const f = feature({ instant: '2026-03-14' });
    expect(describeTemporalStatus(f, new Date('2026-03-14T00:00:00Z'), enStrings)).toBe('Active on 2026-03-14');
  });
});
