import 'leaflet';

declare module 'leaflet' {
  function markerClusterGroup(options?: unknown): L.FeatureGroup;
}
