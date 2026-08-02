import type { Layer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { AppManifest } from '../../manifests/app-manifest';
import type { MapAdapter } from '../map-adapter';
import { createMap } from './map';
import { renderDataLayer as renderLeafletDataLayer } from './data-layer-renderer';
import { mountCoordinateGrid } from './coordinate-grid-layer';

export async function createLeafletMapAdapter(container: HTMLElement, appManifest: AppManifest): Promise<MapAdapter> {
  const { map, baseLayers } = await createMap(container, appManifest);
  const grid = mountCoordinateGrid(map);
  const dataLayers = new Map<string, Layer>();
  let activeBaseLayerId: string | undefined;

  return {
    setActiveBaseLayer(id) {
      if (id === activeBaseLayerId) return;
      const next = baseLayers[id];
      if (!next) return;
      if (activeBaseLayerId !== undefined) map.removeLayer(baseLayers[activeBaseLayerId]);
      next.addTo(map);
      activeBaseLayerId = id;
    },

    renderDataLayer(id, manifest, features, date, activeFilters, onFeatureClick) {
      const existing = dataLayers.get(id);
      if (existing) map.removeLayer(existing);
      dataLayers.set(id, renderLeafletDataLayer(map, manifest, features, date, activeFilters, onFeatureClick));
    },
    removeDataLayer(id) {
      const existing = dataLayers.get(id);
      if (!existing) return;
      map.removeLayer(existing);
      dataLayers.delete(id);
    },

    grid,

    getMetersPerPixel() {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const containerWidth = map.getContainer().clientWidth || 1;
      const metersPerDeg = (Math.PI / 180) * 6371000 * Math.cos((center.lat * Math.PI) / 180);
      return ((bounds.getEast() - bounds.getWest()) * metersPerDeg) / containerWidth;
    },
    onViewChange(handler) {
      map.on('zoomend moveend', handler);
      return () => map.off('zoomend moveend', handler);
    },
  };
}
