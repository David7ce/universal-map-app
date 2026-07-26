import type { GeoFeature } from '../../engine/time/temporal-types';
import { isActiveOn } from '../../engine/time/is-active-on';

export function describeTemporalStatus(feature: GeoFeature, date: Date): string {
  const temporal = feature.properties.temporal;
  const active = isActiveOn(feature, date);

  if (!temporal) return 'Always active';

  if (temporal.instant) {
    return active ? `Active on ${temporal.instant}` : `Occurred on ${temporal.instant}`;
  }

  if (temporal.recurrence) {
    const status = active ? 'Active today' : 'Not active on selected date';
    return `${status} (recurs: ${temporal.recurrence.rule})`;
  }

  if (temporal.range) {
    const from = temporal.range.from ? `since ${temporal.range.from}` : '';
    const to = temporal.range.to ? `until ${temporal.range.to}` : '';
    const status = active ? 'Active' : 'Not active on selected date';
    const bounds = [from, to].filter(Boolean).join(' ');
    return bounds ? `${status} (${bounds})` : status;
  }

  return active ? 'Active' : 'Not active';
}
