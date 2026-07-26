import { describe, expect, it } from 'vitest';
import { parseRule, matchesRule, parseIsoDateUtc } from './rrule-subset';

describe('parseRule', () => {
  it('parses FREQ, BYDAY, INTERVAL, UNTIL, COUNT', () => {
    const parsed = parseRule('FREQ=WEEKLY;BYDAY=SU,WE;INTERVAL=2;UNTIL=2026-12-31;COUNT=10');
    expect(parsed).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['SU', 'WE'],
      until: parseIsoDateUtc('2026-12-31'),
      count: 10,
    });
  });

  it('defaults interval to 1 when omitted', () => {
    expect(parseRule('FREQ=DAILY').interval).toBe(1);
  });

  it('throws on missing FREQ', () => {
    expect(() => parseRule('BYDAY=SU')).toThrow(/FREQ/);
  });

  it('throws on unsupported FREQ', () => {
    expect(() => parseRule('FREQ=SECONDLY')).toThrow(/FREQ/);
  });
});

describe('matchesRule', () => {
  it('matches every Sunday for FREQ=WEEKLY;BYDAY=SU with no anchor', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-16'))).toBe(false);
  });

  it('respects UNTIL', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;UNTIL=2026-03-15');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-22'))).toBe(false);
  });

  it('respects INTERVAL=2 relative to an anchor week', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;INTERVAL=2');
    const anchor = parseIsoDateUtc('2026-03-01');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-01'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-08'), anchor)).toBe(false);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'), anchor)).toBe(true);
  });

  it('throws when COUNT is set without an anchor', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;COUNT=3');
    expect(() => matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toThrow(/COUNT requires/);
  });

  it('respects COUNT relative to an anchor', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=SU;COUNT=2');
    const anchor = parseIsoDateUtc('2026-03-01');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-01'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-08'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'), anchor)).toBe(false);
  });

  it('rejects FREQ=MONTHLY at match time (parses, but unsupported for matching)', () => {
    const rule = parseRule('FREQ=MONTHLY');
    expect(() => matchesRule(rule, parseIsoDateUtc('2026-03-01'))).toThrow(/not supported/);
  });

  it('matches consecutive days for FREQ=DAILY with no anchor', () => {
    const rule = parseRule('FREQ=DAILY');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-15'))).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-16'))).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-17'))).toBe(true);
  });

  it('respects INTERVAL=2 for FREQ=DAILY relative to an anchor', () => {
    const rule = parseRule('FREQ=DAILY;INTERVAL=2');
    const anchor = parseIsoDateUtc('2026-03-01');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-01'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-02'), anchor)).toBe(false);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-03'), anchor)).toBe(true);
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-05'), anchor)).toBe(true);
  });

  it('matches only specified BYDAY for FREQ=DAILY;BYDAY=MO', () => {
    const rule = parseRule('FREQ=DAILY;BYDAY=MO');
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-02'))).toBe(true); // Monday
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-03'))).toBe(false); // Tuesday
    expect(matchesRule(rule, parseIsoDateUtc('2026-03-09'))).toBe(true); // Monday
  });
});
