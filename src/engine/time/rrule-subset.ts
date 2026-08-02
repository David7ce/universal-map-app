export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface ParsedRule {
  freq: Freq;
  interval: number;
  byDay?: string[];
  until?: Date;
  count?: number;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const EPOCH = new Date('1970-01-01T00:00:00Z');
const SUPPORTED_MATCH_FREQ: Freq[] = ['DAILY', 'WEEKLY'];

export function parseIsoDateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function parseRule(rule: string): ParsedRule {
  const parts: Record<string, string> = {};
  for (const pair of rule.split(';')) {
    const [key, value] = pair.split('=');
    if (key && value) parts[key] = value;
  }

  const freq = parts.FREQ as Freq;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    throw new Error(`Unsupported or missing FREQ in rule: "${rule}"`);
  }

  return {
    freq,
    interval: parts.INTERVAL ? Number(parts.INTERVAL) : 1,
    byDay: parts.BYDAY ? parts.BYDAY.split(',') : undefined,
    until: parts.UNTIL ? parseIsoDateUtc(parts.UNTIL) : undefined,
    count: parts.COUNT ? Number(parts.COUNT) : undefined,
  };
}

export function startOfDayUtc(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfWeekUtc(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - copy.getUTCDay());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function matchesPattern(parsed: ParsedRule, date: Date, anchor: Date): boolean {
  if (parsed.byDay) {
    if (!parsed.byDay.includes(DAY_CODES[date.getUTCDay()])) return false;
  }
  if (parsed.freq === 'DAILY') {
    const daysSinceAnchor = Math.round((startOfDayUtc(date).getTime() - startOfDayUtc(anchor).getTime()) / MS_PER_DAY);
    return daysSinceAnchor % parsed.interval === 0;
  }
  const weeksSinceAnchor = Math.round(
    (startOfWeekUtc(date).getTime() - startOfWeekUtc(anchor).getTime()) / MS_PER_WEEK,
  );
  return weeksSinceAnchor % parsed.interval === 0;
}

function countOccurrencesUpTo(parsed: ParsedRule, anchor: Date, date: Date): number {
  let count = 0;
  for (let t = anchor.getTime(); t <= date.getTime(); t += MS_PER_DAY) {
    if (matchesPattern(parsed, new Date(t), anchor)) count += 1;
  }
  return count;
}

export function matchesRule(parsed: ParsedRule, date: Date, anchor?: Date): boolean {
  if (!SUPPORTED_MATCH_FREQ.includes(parsed.freq)) {
    throw new Error(`FREQ=${parsed.freq} is not supported for matching in the v1 RRULE subset (only DAILY, WEEKLY)`);
  }
  if (parsed.count !== undefined && !anchor) {
    throw new Error('COUNT requires temporal.range.from as an anchor date');
  }
  if (parsed.until && startOfDayUtc(date).getTime() > startOfDayUtc(parsed.until).getTime()) return false;

  const effectiveAnchor = anchor ?? EPOCH;
  if (date.getTime() < effectiveAnchor.getTime()) return false;
  if (!matchesPattern(parsed, date, effectiveAnchor)) return false;

  if (parsed.count !== undefined) {
    if (countOccurrencesUpTo(parsed, effectiveAnchor, date) > parsed.count) return false;
  }

  return true;
}
