import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCalendarSystemLoaded } from '../../engine/time/calendar-conversion';
import { stepMonth } from './toolbar-date';

const MIN = '2000-01-01';
const MAX = '2100-12-31';

beforeAll(async () => {
  await ensureCalendarSystemLoaded('islamic');
});

describe('stepMonth', () => {
  it('steps one gregorian month', () => {
    expect(stepMonth('2026-07-15', 'gregorian', 1, MIN, MAX)).toBe('2026-08-15');
    expect(stepMonth('2026-07-15', 'gregorian', -1, MIN, MAX)).toBe('2026-06-15');
  });

  it('rolls over year boundaries', () => {
    expect(stepMonth('2026-12-15', 'gregorian', 1, MIN, MAX)).toBe('2027-01-15');
    expect(stepMonth('2026-01-15', 'gregorian', -1, MIN, MAX)).toBe('2025-12-15');
  });

  it('keeps month-end days inside the target month (no overflow into the next)', () => {
    expect(stepMonth('2026-01-31', 'gregorian', 1, MIN, MAX)).toBe('2026-02-28');
    expect(stepMonth('2026-03-31', 'gregorian', -1, MIN, MAX)).toBe('2026-02-28');
    expect(stepMonth('2028-01-31', 'gregorian', 1, MIN, MAX)).toBe('2028-02-29');
  });

  it('clamps to the world range', () => {
    expect(stepMonth('2026-06-15', 'gregorian', 1, '2026-01-01', '2026-06-20')).toBe('2026-06-20');
    expect(stepMonth('2026-01-10', 'gregorian', -1, '2026-01-01', '2026-06-20')).toBe('2026-01-01');
  });

  it('returns the input unchanged when already at the range edge', () => {
    expect(stepMonth('2026-06-20', 'gregorian', 1, '2026-01-01', '2026-06-20')).toBe('2026-06-20');
  });

  it('steps by a calendar-aware month for non-gregorian systems', () => {
    expect(stepMonth('2026-07-29', 'islamic', 1, MIN, MAX)).toBe('2026-08-27');
  });
});
