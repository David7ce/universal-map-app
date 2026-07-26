import { registerPlugin } from '../../src/engine/plugins/registry';
import { buildParticipateUrl } from './links';
import type { ParticipateConfig } from '../../src/engine/manifests/app-manifest';

export function registerParticipatePlugin(config: ParticipateConfig): void {
  registerPlugin('participate', {
    panelSlot: {
      id: 'participate',
      label: 'Participate',
      icon: 'pushpin',
      render(container, ctx) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Participate';
        button.addEventListener('click', () => {
          window.open(buildParticipateUrl(config, { date: ctx.getSelectedDate() }), '_blank', 'noopener');
        });
        container.appendChild(button);
      },
    },
  });
}
