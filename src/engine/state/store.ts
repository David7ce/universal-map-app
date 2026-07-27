export type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface AppState {
  selectedDate: string;
  activeFilters: Record<string, Set<string>>;
  selectedFeatureId: string | null;
  activeBaseLayerId: string;
  // `left` is the search overlay (button + panel), independent of whether a
  // feature is selected — selection is shown in a separate bottom sheet, not
  // "inside" this panel. `right` is the filters panel.
  panels: { left: 'closed' | 'open'; right: 'open' | 'closed' };
  // Layer ids currently toggled off via the layer control's "map details"
  // group (e.g. a heatmap overlay) — hidden from rendering until re-enabled.
  hiddenLayerIds: Set<string>;
}
