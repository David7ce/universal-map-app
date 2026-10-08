import { describe, expect, it } from 'vitest';
import { legalHref } from './legal-links';

describe('legalHref', () => {
  it('links the English page for en', () => {
    expect(legalHref('privacy', 'en')).toBe('privacy.html');
  });

  it('links the Spanish page for es', () => {
    expect(legalHref('cookies', 'es')).toBe('cookies.es.html');
    expect(legalHref('terms', 'es')).toBe('terms.es.html');
  });
});
