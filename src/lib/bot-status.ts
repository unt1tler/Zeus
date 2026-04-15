import { unstable_noStore as noStore } from "next/cache";
import { getSettings } from "./data";
import type { BotStatus } from "./types";

const BOT_STATUS_URL = "http://127.0.0.1:8081/status";
const BOT_STATUS_TIMEOUT_MS = 1500;

function isBotStatus(value: unknown): value is BotStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.status === "string";
}

export async function getBotStatusSnapshot(): Promise<BotStatus> {
  noStore();

  const settings = await getSettings();
  if (!settings.discordBot.enabled) {
    return { status: "offline" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BOT_STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(BOT_STATUS_URL, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: "offline" };
    }

    const payload: unknown = await response.json();
    if (!isBotStatus(payload)) {
      return { status: "offline" };
    }

    return payload;
  } catch {
    return { status: "offline" };
  } finally {
    clearTimeout(timeoutId);
  }
}
