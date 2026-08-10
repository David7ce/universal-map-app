import type { Layer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { AppManifest } from '../../manifests/app-manifest';
import type { LayerManifest } from '../../manifests/layer-manifest';
import type { GeoFeature } from '../../time/temporal-types';
import type { MapAdapter, MapGrid } from '../map-adapter';
import type { MapCrsConfig } from '../map-crs';
import { createMap } from './map';
import { renderDataLayer as renderLeafletDataLayer } from './data-layer-renderer';
import { mountCoordinateGrid } from './coordinate-grid-layer';

interface RenderedLayerParams {
  manifest: LayerManifest;
  features: GeoFeature[];
  date: Date;
  activeFilters: Record<string, Set<string>>;
  onFeatureClick?: (feature: GeoFeature) => void;
}

export async function createLeafletMapAdapter(container: HTMLElement, appManifest: AppManifest): Promise<MapAdapter> {
  let { map, baseLayers } = await createMap(container, appManifest);
  let grid = mountCoordinateGrid(map);
  let gridVisible = false;

  const dataLayers = new Map<string, Layer>();
  // Replayed onto the new map instance whenever `setCrs` recreates it —
  // `renderDataLayer`'s own params aren't otherwise kept anywhere.
  const renderedLayerParams = new Map<string, RenderedLayerParams>();
  let activeBaseLayerId: string | undefined;
  const viewChangeHandlers = new Set<() => void>();

  function bindViewChangeHandlers(): void {
    viewChangeHandlers.forEach((handler) => map.on('zoomend moveend', handler));
  }

  // Stable object identity across `setCrs` recreations — callers (e.g.
  // SettingsControl.ts) capture `adapter.grid` once at mount time, so the
  // grid itself must stay a proxy that delegates to whatever the current
  // underlying grid is, not the raw handle from `mountCoordinateGrid`.
  const gridProxy: MapGrid = {
    setVisible(visible) {
      gridVisible = visible;
      grid.setVisible(visible);
    },
  };

  const adapter: MapAdapter = {
    setActiveBaseLayer(id) {
      if (id === activeBaseLayerId) return;
      const next = baseLayers[id];
      if (!next) return;
      if (activeBaseLayerId !== undefined) map.removeLayer(baseLayers[activeBaseLayerId]);
      next.addTo(map);
      activeBaseLayerId = id;
    },

    renderDataLayer(id, manifest, features, date, activeFilters, onFeatureClick) {
      renderedLayerParams.set(id, { manifest, features, date, activeFilters, onFeatureClick });
      const existing = dataLayers.get(id);
      if (existing) map.removeLayer(existing);
      dataLayers.set(id, renderLeafletDataLayer(map, manifest, features, date, activeFilters, onFeatureClick));
    },
    removeDataLayer(id) {
      renderedLayerParams.delete(id);
      const existing = dataLayers.get(id);
      if (!existing) return;
      map.removeLayer(existing);
      dataLayers.delete(id);
    },

    grid: gridProxy,

    getMetersPerPixel() {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const containerWidth = map.getContainer().clientWidth || 1;
      const metersPerDeg = (Math.PI / 180) * 6371000 * Math.cos((center.lat * Math.PI) / 180);
      return ((bounds.getEast() - bounds.getWest()) * metersPerDeg) / containerWidth;
    },
    onViewChange(handler) {
      viewChangeHandlers.add(handler);
      map.on('zoomend moveend', handler);
      return () => {
        viewChangeHandlers.delete(handler);
        map.off('zoomend moveend', handler);
      };
    },

    invalidateSize() {
      map.invalidateSize();
    },

    async setCrs(crs: MapCrsConfig | undefined) {
      const previousBaseLayerId = activeBaseLayerId;
      map.remove();

      // Resets to the manifest's original center/zoom rather than the
      // current viewport — a coordinate the user panned to in one CRS
      // (e.g. Web Mercator lat/lng) has no meaningful equivalent in an
      // unrelated one (e.g. Simple's arbitrary pixel space).
      const recreated = await createMap(container, { ...appManifest, map: { ...appManifest.map, crs } });
      map = recreated.map;
      baseLayers = recreated.baseLayers;
      dataLayers.clear();

      grid = mountCoordinateGrid(map);
      grid.setVisible(gridVisible);

      bindViewChangeHandlers();

      activeBaseLayerId = undefined;
      if (previousBaseLayerId !== undefined && baseLayers[previousBaseLayerId]) {
        baseLayers[previousBaseLayerId].addTo(map);
        activeBaseLayerId = previousBaseLayerId;
      }

      for (const [id, params] of renderedLayerParams) {
        dataLayers.set(
          id,
          renderLeafletDataLayer(
            map,
            params.manifest,
            params.features,
            params.date,
            params.activeFilters,
            params.onFeatureClick,
          ),
        );
      }
    },
  };

  return adapter;
}
