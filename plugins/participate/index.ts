import { registerPlugin } from '../../src/engine/plugins/registry';
import { buildParticipateUrl } from './links';
import { t } from '../../src/ui/strings';

export interface ParticipateConfig {
  channel: 'email' | 'whatsapp' | 'telegram';
  target: string;
  messageTemplate: string;
}

function assertParticipateConfig(config: unknown): asserts config is ParticipateConfig {
  const obj = (config ?? {}) as Record<string, unknown>;
  const validChannels = ['email', 'whatsapp', 'telegram'];
  if (!validChannels.includes(obj.channel as string)) {
    throw new Error(`participate plugin has invalid "channel": ${String(obj.channel)}`);
  }
  if (typeof obj.target !== 'string' || obj.target.length === 0) {
    throw new Error('participate plugin "target" must be a non-empty string');
  }
  if (typeof obj.messageTemplate !== 'string' || obj.messageTemplate.length === 0) {
    throw new Error('participate plugin "messageTemplate" must be a non-empty string');
  }
}

export default function register(config: unknown, strings: Record<string, string>): void {
  assertParticipateConfig(config);

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
