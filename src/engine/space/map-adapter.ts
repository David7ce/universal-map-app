import type { LayerManifest } from '../manifests/layer-manifest';
import type { GeoFeature } from '../time/temporal-types';
import type { MapCrsConfig } from './map-crs';

export interface MapGrid {
  setVisible(visible: boolean): void;
}

// The seam between the app and whatever actually draws the map. Everything
// outside `engine/space/leaflet/` (main.ts, app-chrome.ts, LayerControl.ts)
// talks to this interface only — swapping the rendering library (MapLibre,
// OpenLayers, ...) means writing a new adapter, not touching those callers.
export interface MapAdapter {
  setActiveBaseLayer(id: string): void;

  // One call per layer id, replacing whatever was previously rendered under
  // that id — callers don't need to track layer handles themselves.
  renderDataLayer(
    id: string,
    manifest: LayerManifest,
    features: GeoFeature[],
    date: Date,
    activeFilters: Record<string, Set<string>>,
    onFeatureClick?: (feature: GeoFeature) => void,
  ): void;
  removeDataLayer(id: string): void;

  grid: MapGrid;

  // Scale bar support: meters spanned per horizontal pixel at the current
  // view, and a subscription for when that changes (pan/zoom).
  getMetersPerPixel(): number;
  onViewChange(handler: () => void): () => void;

  // Leaflet has no supported way to change `map.options.crs` after
  // construction — switching projection at runtime means tearing down and
  // recreating the underlying map instance. Implementations replay the
  // active base layer and every previously rendered data layer onto the
  // new instance, so callers don't have to re-render anything themselves.
  setCrs(crs: MapCrsConfig | undefined): Promise<void>;

  // Leaflet caches the container's pixel size; when the map's container was
  // hidden (`display: none`, e.g. while Calendar view is showing) and then
  // shown again, panning/zoom controls end up misaligned until this is
  // called once.
  invalidateSize(): void;
}
