import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('AT&T')).toBe('AT&amp;T');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('Ropa <talla grande>')).toBe('Ropa &lt;talla grande&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quote', () => {
    expect(escapeHtml('5" Nails')).toBe('5&quot; Nails');
  });

  it('escapes single quote', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('leaves a string with no special characters unchanged (identity)', () => {
    expect(escapeHtml('Ayuntamiento')).toBe('Ayuntamiento');
  });

  it('escapes multiple special characters in a single string', () => {
    expect(escapeHtml(`<a href="x">Tom & "Jerry's" </a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &quot;Jerry&#39;s&quot; &lt;/a&gt;',
    );
  });
});
