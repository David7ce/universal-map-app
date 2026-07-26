export type TriState = 'all' | 'some' | 'none';

export function getTriState(allValues: string[], selected: Set<string>): TriState {
  if (selected.size === 0) return 'none';
  if (allValues.every((v) => selected.has(v))) return 'all';
  return 'some';
}

export function toggleAll(allValues: string[], selected: Set<string>): Set<string> {
  return getTriState(allValues, selected) === 'all' ? new Set() : new Set(allValues);
}
