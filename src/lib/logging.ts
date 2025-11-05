
import { getSettings } from './data';
import type { Embed } from './types';

interface WebhookPayload {
  username?: string;
  avatar_url?: string;
  embeds?: Embed[];
}

export async function sendWebhook(embed: Embed) {
  const settings = await getSettings();
  if (!settings.logging.enabled || !settings.logging.webhookUrl) {
    return;
  }

  const payload: WebhookPayload = {
    username: "Zeus Logger",
    avatar_url: "https://i.ibb.co/L5fFv9x/zeus-logo.png",
    embeds: [embed],
  };

  try {
    const response = await fetch(settings.logging.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Failed to parse Discord error response.' }));
        console.error(`Error sending webhook: ${response.status} ${response.statusText}`, errorBody);
    }
  } catch (error) {
    console.error('Failed to send webhook:', error);
  }
}
