import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore, type AppState } from '../state/store';
import {
  registerPlugin,
  getPanelSlots,
  dispatchDateChange,
  dispatchFilterChange,
  dispatchFeatureSelect,
  subscribePluginHooks,
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

  it('wires plugin hooks to corresponding state changes only', () => {
    const store = createStore<AppState>({
      selectedDate: '2026-01-01',
      activeFilters: {},
      selectedFeatureId: null,
      activeBaseLayerId: 'street',
      panels: { left: 'closed', right: 'closed' },
      hiddenLayerIds: new Set(),
      calendarSystem: 'gregorian',
      showGrid: false,
      view: 'map',
    });
    const onDateChange = vi.fn();
    const onFilterChange = vi.fn();
    const onFeatureSelect = vi.fn();
    const pluginContext: PluginContext = {
      ...ctx,
      getActiveFeatures: vi.fn(() => []),
      getSelectedFeature: vi.fn(() => null),
    };
    registerPlugin('hooks', { onDateChange, onFilterChange, onFeatureSelect });
    const unsubscribe = subscribePluginHooks(store, pluginContext);

    store.set({ panels: { left: 'open', right: 'closed' } });
    expect(onDateChange).not.toHaveBeenCalled();
    expect(onFilterChange).not.toHaveBeenCalled();
    expect(onFeatureSelect).not.toHaveBeenCalled();

    store.set({ selectedDate: '2026-01-02' });
    expect(onDateChange).toHaveBeenCalledWith('2026-01-02', pluginContext);
    expect(onFilterChange).not.toHaveBeenCalled();

    store.set({ activeFilters: { category: new Set(['shop']) } });
    expect(onFilterChange).toHaveBeenCalledWith([], pluginContext);

    store.set({ selectedFeatureId: 'feature-1' });
    expect(onFeatureSelect).toHaveBeenCalledWith(null, pluginContext);

    unsubscribe();
    store.set({ selectedDate: '2026-01-03' });
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });
});
