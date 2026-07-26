import type { Store, AppState } from '../../engine/state/store';
import type { LoadedLayer } from '../../engine/taxonomy/compute-dimensions';
import { searchFeatures } from './search';
import { describeTemporalStatus } from './temporal-status';
import { t } from '../strings';

export function mountPanelLeft(
  container: HTMLElement,
  store: Store<AppState>,
  layers: LoadedLayer[],
  strings: Record<string, string>
): void {
  container.innerHTML = `
    <input type="search" data-role="search-input" placeholder="${t('search.placeholder', strings)}" />
    <div data-role="results"></div>
    <div data-role="info" hidden></div>
  `;

  const searchInput = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const resultsEl = container.querySelector<HTMLDivElement>('[data-role="results"]')!;
  const infoEl = container.querySelector<HTMLDivElement>('[data-role="info"]')!;
  const allFeatures = layers.flatMap((layer) => layer.features);

  function featureLabel(feature: (typeof allFeatures)[number]): string {
    const props = feature.properties;
    return String(props.nombre ?? props.title ?? feature.id ?? t('search.untitledFeature', strings));
  }

  searchInput.addEventListener('input', () => {
    const matches = searchFeatures(allFeatures, searchInput.value, ['nombre', 'title']);
    resultsEl.innerHTML = matches
      .map((feature, index) => `<button type="button" data-result-index="${index}">${featureLabel(feature)}</button>`)
      .join('');

    resultsEl.querySelectorAll<HTMLButtonElement>('[data-result-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = matches[Number(button.dataset.resultIndex)];
        store.set({ selectedFeatureId: String(feature.id ?? '') });
      });
    });
  });

  store.subscribe((state) => {
    if (state.selectedFeatureId === null) {
      infoEl.hidden = true;
      resultsEl.hidden = false;
      return;
    }
    const feature = allFeatures.find((f) => String(f.id ?? '') === state.selectedFeatureId);
    if (!feature) return;

    const date = new Date(`${state.selectedDate}T00:00:00Z`);
    infoEl.hidden = false;
    resultsEl.hidden = true;
    infoEl.innerHTML = `<h3>${featureLabel(feature)}</h3><p>${describeTemporalStatus(feature, date, strings)}</p>`;
  });
}
