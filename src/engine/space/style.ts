import type { LayerManifest } from '../manifests/layer-manifest';

export interface MarkerStyle {
  cluster: boolean;
  iconName: string;
}

export function resolveMarkerStyle(manifest: LayerManifest): MarkerStyle {
  const style = manifest.style ?? {};
  return {
    cluster: style.cluster === true,
    iconName: typeof style.icon === 'string' ? style.icon : 'default',
  };
}
