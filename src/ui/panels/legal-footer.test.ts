import { describe, expect, it } from 'vitest';
import { renderLegalFooter } from './legal-footer';

describe('renderLegalFooter', () => {
  it('links the English pages by default', () => {
    const html = renderLegalFooter('X', {});
    expect(html).toContain('href="privacy.html"');
    expect(html).toContain('href="cookies.html"');
    expect(html).toContain('href="terms.html"');
  });

  it('links the Spanish pages for es', () => {
    const html = renderLegalFooter('X', {}, 'es');
    expect(html).toContain('href="privacy.es.html"');
    expect(html).toContain('href="cookies.es.html"');
    expect(html).toContain('href="terms.es.html"');
  });
});
