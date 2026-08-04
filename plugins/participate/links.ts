import type { ParticipateConfig } from './index';

export function buildParticipateUrl(config: ParticipateConfig, context: { date: string }): string {
  const message = config.messageTemplate.replace('{{date}}', context.date);

  switch (config.channel) {
    case 'email':
      return `mailto:${config.target}?subject=${encodeURIComponent(message)}`;
    case 'whatsapp':
      return `https://wa.me/${config.target}?text=${encodeURIComponent(message)}`;
    case 'telegram':
      return `https://t.me/${config.target}?text=${encodeURIComponent(message)}`;
    default: {
      const exhaustive: never = config.channel;
      throw new Error(`Unknown participate channel: ${String(exhaustive)}`);
    }
  }
}
