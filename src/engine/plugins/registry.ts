import type { GeoFeature } from '../time/temporal-types';

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

export function _resetPluginsForTest(): void {
  plugins.clear();
}
