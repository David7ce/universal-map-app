import { describe, expect, it } from 'vitest';
import { renderInlineCode } from './inline-code';

describe('renderInlineCode', () => {
  it('wraps backtick spans in <code>', () => {
    expect(renderInlineCode('Create `worlds/<id>/` first')).toBe('Create <code>worlds/&lt;id&gt;/</code> first');
  });

  it('escapes HTML outside code spans', () => {
    expect(renderInlineCode('<b>x</b> & `y`')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; <code>y</code>');
  });

  it('leaves an unmatched backtick as plain text', () => {
    expect(renderInlineCode('a ` b')).toBe('a ` b');
  });

  it('returns an empty string for empty input', () => {
    expect(renderInlineCode('')).toBe('');
  });
});
