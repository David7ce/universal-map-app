import { describe, expect, it, vi } from 'vitest';
import { createStore, openPanel } from './store';
import type { AppState } from './store';

function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    selectedDate: '2026-01-01',
    activeFilters: {},
    selectedFeatureId: null,
    activeBaseLayerId: 'base',
    panels: { left: 'closed', right: 'closed' },
    hiddenLayerIds: new Set(),
    calendarSystem: 'gregorian',
    showGrid: false,
    view: 'map',
    ...overrides,
  };
}

describe('createStore', () => {
  it('returns the initial state from get()', () => {
    const store = createStore({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  it('merges patches with set()', () => {
    const store = createStore({ count: 0, name: 'a' });
    store.set({ count: 1 });
    expect(store.get()).toEqual({ count: 1, name: 'a' });
  });

  it('notifies subscribers with the new state on set()', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 5 });
    expect(listener).toHaveBeenCalledWith({ count: 5 });
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ count: 5 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('openPanel', () => {
  it('opens the left panel and closes the right one', () => {
    const store = createStore(makeAppState({ panels: { left: 'closed', right: 'open' } }));
    openPanel(store, 'left');
    expect(store.get().panels).toEqual({ left: 'open', right: 'closed' });
  });

  it('opens the right panel and closes the left one', () => {
    const store = createStore(makeAppState({ panels: { left: 'open', right: 'closed' } }));
    openPanel(store, 'right');
    expect(store.get().panels).toEqual({ left: 'closed', right: 'open' });
  });

  it('leaves the rest of the state untouched', () => {
    const store = createStore(makeAppState({ selectedFeatureId: 'poi-1' }));
    openPanel(store, 'right');
    expect(store.get().selectedFeatureId).toBe('poi-1');
  });
});
