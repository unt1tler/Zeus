import crypto from "crypto";
import { getBlacklist, getSettings } from "./data";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminApiEndpoints, ClientUser } from "./types";
import { extractClientIp } from "./utils";

export const ADMIN_SESSION_COOKIE = "session";
export const CLIENT_USER_COOKIE = "user";
export const DISCORD_OAUTH_STATE_COOKIE = "discord_oauth_state";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const CLIENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DISCORD_OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

type AdminSessionPayload = {
  type: "admin_session";
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

type ClientSessionPayload = {
  type: "client_session";
  sessionId: string;
  user: ClientUser;
  issuedAt: number;
  expiresAt: number;
};

type OAuthStatePayload = {
  type: "discord_oauth_state";
  state: string;
  issuedAt: number;
  expiresAt: number;
};

function getSessionSecret(): string | null {
  return process.env.SESSION_SECRET ?? null;
}

export function shouldUseSecureCookies(): boolean {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "0" || override === "false" || override === "no") {
    return false;
  }
  if (override === "1" || override === "true" || override === "yes") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

function encodePayload(payload: string): string {
  return Buffer.from(payload, "utf8").toString("base64url");
}

function decodePayload(payload: string): string {
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    if (decoded.startsWith("{") || decoded.startsWith("[")) {
      return decoded;
    }
  } catch {}

  return payload;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

const adminRateLimit = new Map<string, { count: number; reset: number }>();
const ADMIN_RATE_LIMIT = 120;
const ADMIN_RATE_WINDOW = 60_000;

function parseSignedJsonValue<T>(
  value: string,
  validator: (parsed: unknown) => parsed is T
): T | null {
  try {
    const dotIdx = value.indexOf(".");
    if (dotIdx === -1) return null;

    const sig = value.slice(0, dotIdx);
    const payload = value.slice(dotIdx + 1);
    const secret = getSessionSecret();
    if (!secret) return null;

    const expected = signPayload(payload, secret);
    if (!timingSafeCompare(sig, expected)) return null;

    const parsed = JSON.parse(decodePayload(payload));
    return validator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createSignedJsonValue(payload: unknown): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const encodedPayload = encodePayload(JSON.stringify(payload));
  const sig = signPayload(encodedPayload, secret);
  return `${sig}.${encodedPayload}`;
}

function isClientUser(value: unknown): value is ClientUser {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.username === "string";
}

function isClientSessionPayload(value: unknown): value is ClientSessionPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "client_session" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number" &&
    isClientUser(candidate.user)
  );
}

function isAdminSessionPayload(value: unknown): value is AdminSessionPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "admin_session" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}

function isOAuthStatePayload(value: unknown): value is OAuthStatePayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "discord_oauth_state" &&
    typeof candidate.state === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}

export function createClientUserCookieValue(user: ClientUser): string | null {
  const now = Date.now();
  return createSignedJsonValue({
    type: "client_session",
    sessionId: crypto.randomUUID(),
    user,
    issuedAt: now,
    expiresAt: now + CLIENT_SESSION_MAX_AGE_SECONDS * 1000,
  } satisfies ClientSessionPayload);
}

export function createAdminSessionCookieValue(): string | null {
  const now = Date.now();
  return createSignedJsonValue({
    type: "admin_session",
    sessionId: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  } satisfies AdminSessionPayload);
}

export function createDiscordOAuthState(): { state: string; cookieValue: string | null } {
  const now = Date.now();
  const state = crypto.randomBytes(32).toString("hex");

  return {
    state,
    cookieValue: createSignedJsonValue({
      type: "discord_oauth_state",
      state,
      issuedAt: now,
      expiresAt: now + DISCORD_OAUTH_STATE_MAX_AGE_SECONDS * 1000,
    } satisfies OAuthStatePayload),
  };
}

export async function checkAdminApiKey(endpointName?: keyof AdminApiEndpoints) {
  const headersList = await headers();
  const clientIp = extractClientIp(headersList, { trustInternalHeader: true });
  const now = Date.now();

  if (adminRateLimit.size > 1000) {
    for (const [ip, entry] of adminRateLimit) {
      if (now > entry.reset) adminRateLimit.delete(ip);
    }
  }

  const rl = adminRateLimit.get(clientIp);
  if (rl && now < rl.reset) {
    if (rl.count >= ADMIN_RATE_LIMIT) {
      return { authorized: false, status: 429, message: "Rate limit exceeded." } as const;
    }
    rl.count++;
  } else {
    adminRateLimit.set(clientIp, { count: 1, reset: now + ADMIN_RATE_WINDOW });
  }

  const settings = await getSettings();
  if (!settings.adminApiEnabled) {
    return { authorized: false, status: 403, message: "Admin API is disabled." } as const;
  }

  const apiKey = headersList.get("x-api-key");

  if (!apiKey || !settings.apiKey || !timingSafeCompare(apiKey, settings.apiKey)) {
    return { authorized: false, status: 401, message: "Invalid or missing API key." } as const;
  }

  if (endpointName) {
    if (settings.adminApiEndpoints[endpointName] === false) {
      return { authorized: false, status: 403, message: "This endpoint is disabled." } as const;
    }
  }

  return { authorized: true } as const;
}

export function verifySignedCookie(cookieValue: string): ClientUser | null {
  const session = parseSignedJsonValue(cookieValue, isClientSessionPayload);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  return session.user;
}

export function verifyAdminSessionCookie(cookieValue: string): AdminSessionPayload | null {
  const session = parseSignedJsonValue(cookieValue, isAdminSessionPayload);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

export function verifyDiscordOAuthStateCookie(cookieValue: string): OAuthStatePayload | null {
  const oauthState = parseSignedJsonValue(cookieValue, isOAuthStatePayload);
  if (!oauthState) return null;
  if (oauthState.expiresAt <= Date.now()) return null;
  return oauthState;
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const sessionCookie = (await cookies()).get(ADMIN_SESSION_COOKIE);
  if (!sessionCookie?.value) return null;
  return verifyAdminSessionCookie(sessionCookie.value);
}

export async function getAuthenticatedClientUser(): Promise<ClientUser | null> {
  const userCookie = (await cookies()).get(CLIENT_USER_COOKIE);
  if (!userCookie?.value) return null;

  const user = verifySignedCookie(userCookie.value);
  if (!user) return null;

  const settings = await getSettings();
  if (!settings.clientPanel?.enabled) {
    return null;
  }

  const blacklist = await getBlacklist();
  if (blacklist.discordIds.includes(user.id)) {
    return null;
  }

  return user;
}

export async function requireAuthenticatedClientUser(): Promise<ClientUser> {
  const user = await getAuthenticatedClientUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

export async function checkBotApiKey() {
  const settings = await getSettings();
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");

  if (!apiKey || !settings.apiKey || !timingSafeCompare(apiKey, settings.apiKey)) {
    return { authorized: false, status: 401, message: "Invalid or missing API key." } as const;
  }
  return { authorized: true } as const;
}

export function getAdminSessionMaxAge(): number {
  return ADMIN_SESSION_MAX_AGE_SECONDS;
}

export function getClientSessionMaxAge(): number {
  return CLIENT_SESSION_MAX_AGE_SECONDS;
}

export function getDiscordOAuthStateMaxAge(): number {
  return DISCORD_OAUTH_STATE_MAX_AGE_SECONDS;
}
