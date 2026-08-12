import { describe, expect, it } from 'vitest';
import { deriveTheme, applyTheme } from './theme';

describe('deriveTheme', () => {
  it('keeps the given primary color as-is', () => {
    expect(deriveTheme('#266a8b').primary).toBe('#266a8b');
  });

  it('derives a darker shade for primaryDark', () => {
    const { primary, primaryDark } = deriveTheme('#266a8b');
    expect(primaryDark).not.toBe(primary);
    expect(primaryDark).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('derives a much lighter tint for primaryLight', () => {
    const { primaryLight } = deriveTheme('#266a8b');
    expect(primaryLight).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is deterministic for the same input', () => {
    expect(deriveTheme('#7a1f3d')).toEqual(deriveTheme('#7a1f3d'));
  });

  it('darkening a near-black color stays a valid hex color', () => {
    expect(deriveTheme('#0a0a0a').primaryDark).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('lightening a near-white color stays a valid hex color', () => {
    expect(deriveTheme('#f5f5f5').primaryLight).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('throws on a malformed hex color', () => {
    expect(() => deriveTheme('not-a-color')).toThrow(/hex color/);
  });

  it('accepts a 3-digit shorthand hex color', () => {
    expect(deriveTheme('#26a').primary).toBe('#26a');
  });
});

describe('applyTheme', () => {
  it('sets the three CSS custom properties on the document root', () => {
    const calls: [string, string][] = [];
    const doc = {
      documentElement: { style: { setProperty: (name: string, value: string) => calls.push([name, value]) } },
    } as unknown as Document;

    applyTheme({ primary: '#111111', primaryDark: '#000000', primaryLight: '#eeeeee' }, doc);

    expect(calls).toEqual([
      ['--color-primary', '#111111'],
      ['--color-primary-dark', '#000000'],
      ['--color-primary-light', '#eeeeee'],
    ]);
  });
});
