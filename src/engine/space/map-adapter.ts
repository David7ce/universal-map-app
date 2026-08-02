import type { LayerManifest } from '../manifests/layer-manifest';
import type { GeoFeature } from '../time/temporal-types';

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
}
