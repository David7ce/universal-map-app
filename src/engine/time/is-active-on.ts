import type { GeoFeature } from './temporal-types';
import { parseRule, matchesRule, parseIsoDateUtc } from './rrule-subset';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isActiveOn(feature: GeoFeature, date: Date): boolean {
  const temporal = feature.properties.temporal;
  if (!temporal) return true;

  if (temporal.instant) {
    return parseIsoDateUtc(temporal.instant).getTime() === date.getTime();
  }

  const from = temporal.range?.from ? parseIsoDateUtc(temporal.range.from) : undefined;
  const to = temporal.range?.to ? parseIsoDateUtc(temporal.range.to) : undefined;

  if (from && date.getTime() < from.getTime()) return false;
  if (to && date.getTime() > to.getTime()) return false;

  if (temporal.recurrence) {
    if (temporal.recurrence.exceptions?.includes(isoDate(date))) return false;
    const parsed = parseRule(temporal.recurrence.rule);
    return matchesRule(parsed, date, from);
  }

  return true;
}
