import type { NextRequest } from "next/server";

export type BuiltByBitPayload = Record<string, string>;

function normalizeScalarValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function normalizeRecordEntries(entries: Iterable<[string, unknown]>): BuiltByBitPayload {
  const payload: BuiltByBitPayload = {};

  for (const [key, value] of entries) {
    const normalized = normalizeScalarValue(value);
    if (normalized !== undefined) {
      payload[key] = normalized;
    }
  }

  return payload;
}

export async function parseBuiltByBitPayload(request: NextRequest): Promise<BuiltByBitPayload> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid JSON body.");
    }
    return normalizeRecordEntries(Object.entries(body));
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    return normalizeRecordEntries(new URLSearchParams(text).entries());
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return normalizeRecordEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name])
    );
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return normalizeRecordEntries(Object.entries(parsed));
    }
  } catch {}

  return normalizeRecordEntries(new URLSearchParams(rawBody).entries());
}

export function matchesBuiltByBitPurchaseTimestamp(
  storedPurchaseTimestamp: string | undefined,
  incomingPurchaseTimestamp: string | undefined
): boolean {
  if (!incomingPurchaseTimestamp) {
    return true;
  }

  return (storedPurchaseTimestamp?.trim() ?? "") === incomingPurchaseTimestamp.trim();
}
