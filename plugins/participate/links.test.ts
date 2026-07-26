import { describe, expect, it } from 'vitest';
import { buildParticipateUrl } from './links';

describe('buildParticipateUrl', () => {
  it('builds a mailto link with an encoded subject', () => {
    const url = buildParticipateUrl(
      { channel: 'email', target: 'demo@example.org', messageTemplate: 'Report for {{date}}' },
      { date: '2026-07-26' }
    );
    expect(url).toBe('mailto:demo@example.org?subject=Report%20for%202026-07-26');
  });

  it('builds a WhatsApp deep link', () => {
    const url = buildParticipateUrl(
      { channel: 'whatsapp', target: '34600000000', messageTemplate: 'Hi, re: {{date}}' },
      { date: '2026-07-26' }
    );
    expect(url).toBe('https://wa.me/34600000000?text=Hi%2C%20re%3A%202026-07-26');
  });

  it('builds a Telegram deep link', () => {
    const url = buildParticipateUrl(
      { channel: 'telegram', target: 'demo_bot', messageTemplate: 'Hi {{date}}' },
      { date: '2026-07-26' }
    );
    expect(url).toBe('https://t.me/demo_bot?text=Hi%202026-07-26');
  });
});
