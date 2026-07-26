import type { GeoFeature } from '../../engine/time/temporal-types';
import { isActiveOn } from '../../engine/time/is-active-on';
import { t } from '../strings';

export function describeTemporalStatus(feature: GeoFeature, date: Date, strings: Record<string, string>): string {
  const temporal = feature.properties.temporal;
  const active = isActiveOn(feature, date);

  if (!temporal) return t('temporalStatus.alwaysActive', strings);

  if (temporal.instant) {
    return active
      ? t('temporalStatus.activeOn', strings, { date: temporal.instant })
      : t('temporalStatus.occurredOn', strings, { date: temporal.instant });
  }

  if (temporal.recurrence) {
    const status = active
      ? t('temporalStatus.activeToday', strings)
      : t('temporalStatus.notActiveOnSelectedDate', strings);
    const recurs = t('temporalStatus.recurs', strings, { rule: temporal.recurrence.rule });
    return `${status} (${recurs})`;
  }

  if (temporal.range) {
    const from = temporal.range.from ? t('temporalStatus.since', strings, { date: temporal.range.from }) : '';
    const to = temporal.range.to ? t('temporalStatus.until', strings, { date: temporal.range.to }) : '';
    const status = active ? t('temporalStatus.active', strings) : t('temporalStatus.notActiveOnSelectedDate', strings);
    const bounds = [from, to].filter(Boolean).join(' ');
    return bounds ? `${status} (${bounds})` : status;
  }

  return active ? t('temporalStatus.active', strings) : t('temporalStatus.notActive', strings);
}
