import { describe, expect, it } from 'vitest';
import { renderLanguageToggle } from './language-toggle';

describe('renderLanguageToggle', () => {
  it('renders one button per language with aria-pressed only on the active one', () => {
    const html = renderLanguageToggle(['en', 'es'], 'es', 'Language');
    expect(html).toContain('data-lang="en" aria-pressed="false"');
    expect(html).toContain('data-lang="es" aria-pressed="true"');
    expect(html).toContain('>EN<');
    expect(html).toContain('>ES<');
  });

  it('puts the group label in aria-label, escaped', () => {
    expect(renderLanguageToggle(['en'], 'en', 'A "b"')).toContain('aria-label="A &quot;b&quot;"');
  });
});
