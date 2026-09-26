import type { GeoFeature } from '../time/temporal-types';
import type { AppState, Store } from '../state/store';

export interface PluginContext {
  getSelectedDate(): string;
  getActiveFeatures(): GeoFeature[];
  getSelectedFeature(): GeoFeature | null;
}

export interface PanelSlot {
  id: string;
  label: string;
  icon: string;
  render(container: HTMLElement, ctx: PluginContext): void;
}

export interface PluginHooks {
  panelSlot?: PanelSlot;
  onDateChange?(date: string, ctx: PluginContext): void;
  onFilterChange?(activeFeatures: GeoFeature[], ctx: PluginContext): void;
  onFeatureSelect?(feature: GeoFeature | null, ctx: PluginContext): void;
}

const plugins = new Map<string, PluginHooks>();

export function registerPlugin(id: string, hooks: PluginHooks): void {
  plugins.set(id, hooks);
}

export function getPanelSlots(): PanelSlot[] {
  return Array.from(plugins.values())
    .map((hooks) => hooks.panelSlot)
    .filter((slot): slot is PanelSlot => slot !== undefined);
}

export function dispatchDateChange(date: string, ctx: PluginContext): void {
  for (const hooks of plugins.values()) hooks.onDateChange?.(date, ctx);
}

export function dispatchFilterChange(activeFeatures: GeoFeature[], ctx: PluginContext): void {
  for (const hooks of plugins.values()) hooks.onFilterChange?.(activeFeatures, ctx);
}

export function dispatchFeatureSelect(feature: GeoFeature | null, ctx: PluginContext): void {
  for (const hooks of plugins.values()) hooks.onFeatureSelect?.(feature, ctx);
}

/** Subscribe registered plugin hooks to meaningful application state changes. */
export function subscribePluginHooks(store: Store<AppState>, ctx: PluginContext): () => void {
  let previous = store.get();

  return store.subscribe((state) => {
    const dateChanged = state.selectedDate !== previous.selectedDate;
    const filtersChanged = state.activeFilters !== previous.activeFilters;
    const layersChanged = state.hiddenLayerIds !== previous.hiddenLayerIds;
    const selectionChanged = state.selectedFeatureId !== previous.selectedFeatureId;

    previous = state;

    if (dateChanged) dispatchDateChange(state.selectedDate, ctx);
    if (filtersChanged || layersChanged) dispatchFilterChange(ctx.getActiveFeatures(), ctx);
    if (selectionChanged) dispatchFeatureSelect(ctx.getSelectedFeature(), ctx);
  });
}

export function _resetPluginsForTest(): void {
  plugins.clear();
}
