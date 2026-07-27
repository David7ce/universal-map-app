import { registerPlugin } from '../../src/engine/plugins/registry';
import { buildParticipateUrl } from './links';
import type { ParticipateConfig } from '../../src/engine/manifests/app-manifest';
import { t } from '../../src/ui/strings';

export function registerParticipatePlugin(config: ParticipateConfig, strings: Record<string, string>): void {
  registerPlugin('participate', {
    panelSlot: {
      id: 'participate',
      label: t('participate.button', strings),
      icon: 'pushpin',
      render(container, ctx) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = t('participate.button', strings);
        button.addEventListener('click', () => {
          window.open(buildParticipateUrl(config, { date: ctx.getSelectedDate() }), '_blank', 'noopener');
        });
        container.appendChild(button);
      },
    },
  });
}
