import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerPlugin,
  getPanelSlots,
  dispatchDateChange,
  dispatchFilterChange,
  dispatchFeatureSelect,
  _resetPluginsForTest,
  type PluginContext,
} from './registry';

const ctx: PluginContext = {
  getSelectedDate: () => '2026-01-01',
  getActiveFeatures: () => [],
  getSelectedFeature: () => null,
};

afterEach(() => {
  _resetPluginsForTest();
});

describe('plugin registry', () => {
  it('lists registered panel slots', () => {
    registerPlugin('a', { panelSlot: { id: 'a', label: 'A', icon: 'x', render: () => {} } });
    expect(getPanelSlots().map((s) => s.id)).toEqual(['a']);
  });

  it('omits plugins with no panel slot', () => {
    registerPlugin('a', {});
    expect(getPanelSlots()).toEqual([]);
  });

  it('dispatches onDateChange to every registered plugin', () => {
    const onDateChange = vi.fn();
    registerPlugin('a', { onDateChange });
    dispatchDateChange('2026-02-01', ctx);
    expect(onDateChange).toHaveBeenCalledWith('2026-02-01', ctx);
  });

  it('dispatches onFilterChange and onFeatureSelect', () => {
    const onFilterChange = vi.fn();
    const onFeatureSelect = vi.fn();
    registerPlugin('a', { onFilterChange, onFeatureSelect });
    dispatchFilterChange([], ctx);
    dispatchFeatureSelect(null, ctx);
    expect(onFilterChange).toHaveBeenCalledWith([], ctx);
    expect(onFeatureSelect).toHaveBeenCalledWith(null, ctx);
  });
});
