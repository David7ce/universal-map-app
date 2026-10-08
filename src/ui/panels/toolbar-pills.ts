import { computeTaxonomyDimensions, type LoadedLayer } from '../../engine/taxonomy/compute-dimensions';

export interface ToolbarPill {
  dimensionId: string;
  dimensionLabel: string;
  value: string;
  // Features with this value active on the selected date; 0 renders dimmed.
  count: number;
  icons?: Record<string, string>;
  defaultIcon?: string;
}

// Every value of every dimension, in manifest order, with how many features
// carry it on `date`. `computeTaxonomyDimensions(layers, null)` lists all
// values; the dated call tells us which are active. A dimension with nothing
// active on the date is dropped entirely (e.g. a seasonal world off-season).
export function buildToolbarPills(
  layers: LoadedLayer[],
  date: Date | null,
  hiddenLayerIds: Set<string>,
): ToolbarPill[] {
  const shown = layers.filter((layer) => !hiddenLayerIds.has(layer.manifest.id));
  const activeCounts = new Map<string, Map<string, number>>();
  for (const dimension of computeTaxonomyDimensions(shown, date)) {
    activeCounts.set(dimension.id, new Map(dimension.values.map((v) => [v.value, v.count])));
  }

  const pills: ToolbarPill[] = [];
  for (const dimension of computeTaxonomyDimensions(shown, null)) {
    const counts = activeCounts.get(dimension.id);
    if (!counts || counts.size === 0) continue;
    for (const { value } of dimension.values) {
      pills.push({
        dimensionId: dimension.id,
        dimensionLabel: dimension.label,
        value,
        count: counts.get(value) ?? 0,
        icons: dimension.icons,
        defaultIcon: dimension.defaultIcon,
      });
    }
  }
  return pills;
}

export function splitVisiblePills(
  pills: ToolbarPill[],
  maxVisible: number,
): { visible: ToolbarPill[]; overflow: ToolbarPill[] } {
  const max = Math.max(0, maxVisible);
  // A "More" button holding a single pill is no saving — show that pill.
  if (pills.length - max <= 1 && max > 0) return { visible: pills, overflow: [] };
  return { visible: pills.slice(0, max), overflow: pills.slice(max) };
}

export function countActiveIn(pills: ToolbarPill[], activeFilters: Record<string, Set<string>>): number {
  return pills.filter((p) => activeFilters[p.dimensionId]?.has(p.value)).length;
}
