import { describe, expect, it } from 'vitest';
import { detectDefaultLanguage } from './language';

describe('detectDefaultLanguage', () => {
  it('detects Spanish from a plain "es" tag', () => {
    expect(detectDefaultLanguage('es')).toBe('es');
  });

  it('detects Spanish from a region-qualified tag', () => {
    expect(detectDefaultLanguage('es-ES')).toBe('es');
  });

  it('is case-insensitive', () => {
    expect(detectDefaultLanguage('ES-mx')).toBe('es');
  });

  it('falls back to English for any other language', () => {
    expect(detectDefaultLanguage('en-US')).toBe('en');
    expect(detectDefaultLanguage('fr')).toBe('en');
    expect(detectDefaultLanguage('de-DE')).toBe('en');
  });
});
