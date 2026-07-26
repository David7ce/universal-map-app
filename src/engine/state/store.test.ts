import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

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
