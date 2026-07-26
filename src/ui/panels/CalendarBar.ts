import type { Store, AppState } from '../../engine/state/store';

export interface CalendarConfig {
  default: string;
  min: string;
  max: string;
}

export function mountCalendarBar(container: HTMLElement, store: Store<AppState>, config: CalendarConfig): void {
  container.innerHTML = `
    <button type="button" data-action="prev">&larr;</button>
    <input type="date" data-role="date-input" min="${config.min}" max="${config.max}" />
    <button type="button" data-action="next">&rarr;</button>
  `;

  const dateInput = container.querySelector<HTMLInputElement>('[data-role="date-input"]')!;
  dateInput.value = store.get().selectedDate;

  function stepDate(deltaDays: number): void {
    const current = new Date(`${store.get().selectedDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + deltaDays);
    const next = current.toISOString().slice(0, 10);
    store.set({ selectedDate: next });
  }

  container.querySelector('[data-action="prev"]')!.addEventListener('click', () => stepDate(-1));
  container.querySelector('[data-action="next"]')!.addEventListener('click', () => stepDate(1));
  dateInput.addEventListener('change', () => store.set({ selectedDate: dateInput.value }));

  store.subscribe((state) => {
    if (dateInput.value !== state.selectedDate) dateInput.value = state.selectedDate;
  });
}
