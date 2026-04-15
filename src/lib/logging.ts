import { getSettings } from './data';
import type { Embed } from './types';

interface WebhookPayload {
  username?: string;
  avatar_url?: string;
  embeds?: Embed[];
}

const WEBHOOK_TIMEOUT_MS = 2000;

export async function sendWebhook(embed: Embed, webhookConfig?: { enabled: boolean; webhookUrl: string }) {
  const config = webhookConfig ?? (await getSettings()).logging;
  if (!config?.enabled || !config?.webhookUrl) return;

  const payload: WebhookPayload = {
    username: "Zeus Logger",
    avatar_url: "https://i.ibb.co/L5fFv9x/zeus-logo.png",
    embeds: [embed],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => {
      clearTimeout(timeoutId);
    });
}
