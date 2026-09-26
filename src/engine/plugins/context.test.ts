import { describe, expect, it } from 'vitest';
import { createStore, type AppState } from '../state/store';
import type { LoadedLayer } from '../taxonomy/compute-dimensions';
import { createPluginContext } from './context';

const store = () =>
  createStore<AppState>({
    selectedDate: '2026-01-01',
    activeFilters: {},
    selectedFeatureId: 'shop-1',
    activeBaseLayerId: 'street',
    panels: { left: 'closed', right: 'closed' },
    hiddenLayerIds: new Set(),
    calendarSystem: 'gregorian',
    showGrid: false,
    view: 'map',
  });

const layer: LoadedLayer = {
  manifest: {
    id: 'places',
    title: 'Places',
    kind: 'point',
    source: { type: 'geojson', url: '/places.geojson' },
    taxonomy: [{ id: 'category', label: 'Category', field: 'properties.category' }],
  },
  features: [
    {
      type: 'Feature',
      id: 'shop-1',
      properties: { category: 'shop' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      type: 'Feature',
      id: 'museum-1',
      properties: { category: 'museum' },
      geometry: { type: 'Point', coordinates: [1, 1] },
    },
    {
      type: 'Feature',
      id: 'old-1',
      properties: { category: 'shop', temporal: { instant: '2020-01-01' } },
      geometry: { type: 'Point', coordinates: [2, 2] },
    },
  ],
};

describe('createPluginContext', () => {
  it('exposes the current date, selected feature, and currently active visible features', () => {
    const appStore = store();
    const context = createPluginContext(appStore, [layer]);

    expect(context.getSelectedDate()).toBe('2026-01-01');
    expect(context.getSelectedFeature()?.id).toBe('shop-1');
    expect(context.getActiveFeatures().map((feature) => feature.id)).toEqual(['shop-1', 'museum-1']);

    appStore.set({ activeFilters: { category: new Set(['shop']) } });
    expect(context.getActiveFeatures().map((feature) => feature.id)).toEqual(['shop-1']);

    appStore.set({ hiddenLayerIds: new Set(['places']) });
    expect(context.getActiveFeatures()).toEqual([]);
  });
});
