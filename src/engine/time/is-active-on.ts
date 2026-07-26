import type { GeoFeature } from './temporal-types';
import { parseRule, matchesRule, parseIsoDateUtc, startOfDayUtc } from './rrule-subset';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isActiveOn(feature: GeoFeature, date: Date): boolean {
  const temporal = feature.properties.temporal;
  if (!temporal) return true;

  const normalizedDate = startOfDayUtc(date);

  if (temporal.instant) {
    return parseIsoDateUtc(temporal.instant).getTime() === normalizedDate.getTime();
  }

  const from = temporal.range?.from ? parseIsoDateUtc(temporal.range.from) : undefined;
  const to = temporal.range?.to ? parseIsoDateUtc(temporal.range.to) : undefined;

  if (from && normalizedDate.getTime() < from.getTime()) return false;
  if (to && normalizedDate.getTime() > to.getTime()) return false;

  if (temporal.recurrence) {
    if (temporal.recurrence.exceptions?.includes(isoDate(date))) return false;
    const parsed = parseRule(temporal.recurrence.rule);
    return matchesRule(parsed, date, from);
  }

  return true;
}
