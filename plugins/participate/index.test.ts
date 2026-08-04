import { afterEach, describe, expect, it } from 'vitest';
import register from './index';
import { getPanelSlots, _resetPluginsForTest } from '../../src/engine/plugins/registry';

const strings = { 'participate.button': 'Report a sighting' };

afterEach(() => {
  _resetPluginsForTest();
});

describe('participate plugin register()', () => {
  const validConfig = { channel: 'email', target: 'a@b.com', messageTemplate: 'Hi {{date}}' };

  it('registers a panel slot for a valid config', () => {
    register(validConfig, strings);
    expect(getPanelSlots().map((s) => s.id)).toEqual(['participate']);
  });

  it('rejects an invalid channel', () => {
    const invalid = { channel: 'carrier-pigeon', target: 'a@b.com', messageTemplate: 'Hi' };
    expect(() => register(invalid, strings)).toThrow(/channel/);
  });

  it('rejects a missing target', () => {
    const invalid = { channel: 'email', messageTemplate: 'Hi' };
    expect(() => register(invalid, strings)).toThrow(/target/);
  });

  it('rejects an empty target', () => {
    const invalid = { channel: 'email', target: '', messageTemplate: 'Hi' };
    expect(() => register(invalid, strings)).toThrow(/target/);
  });

  it('rejects a missing messageTemplate', () => {
    const invalid = { channel: 'email', target: 'a@b.com' };
    expect(() => register(invalid, strings)).toThrow(/messageTemplate/);
  });

  it('rejects an empty messageTemplate', () => {
    const invalid = { channel: 'email', target: 'a@b.com', messageTemplate: '' };
    expect(() => register(invalid, strings)).toThrow(/messageTemplate/);
  });
});
