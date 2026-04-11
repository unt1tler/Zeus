import { NextResponse, NextRequest } from "next/server";
import { getLicenses, saveLicenses, addLog, getProducts, getBlacklist, getSettings, fetchDiscordUser } from "@/lib/data";
import { extractClientIp as extractTrustedClientIp, normalizeIp } from "@/lib/utils";
import type { ValidationLog } from "@/lib/types";

const DISCORD_ID_RE = /^\d{15,22}$/;
const MAX_KEY_LEN = 128;
const MAX_HWID_LEN = 512;
const HWID_FORMAT_RE = /^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/;

const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Opportunistic cleanup when map gets large
  if (rateLimitMap.size > 1000) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.reset) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

const geoCache = new Map<string, { data: ValidationLog["location"]; exp: number }>();
const GEO_CACHE_TTL = 86_400_000; // 24hr
const GEO_CACHE_MAX = 10_000;

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

async function getLocation(ip: string): Promise<ValidationLog["location"] | null> {
  if (isPrivateIp(ip)) {
    return null;
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.exp) return cached.data;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Zeus/1.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const longitude = Number(data.longitude);
    const latitude = Number(data.latitude);
    const result: ValidationLog["location"] = {
      city: typeof data.city === "string" ? data.city : "Unknown",
      country: typeof data.country_name === "string" ? data.country_name : "Unknown",
      countryCode: typeof data.country_code === "string" ? data.country_code : "XX",
      ...(Number.isFinite(longitude) && Number.isFinite(latitude)
        ? { coordinates: [longitude, latitude] as [number, number] }
        : {}),
    };
    if (geoCache.size >= GEO_CACHE_MAX) {
      const half = Math.floor(GEO_CACHE_MAX / 2);
      let i = 0;
      for (const k of geoCache.keys()) {
        if (i++ >= half) break;
        geoCache.delete(k);
      }
    }
    geoCache.set(ip, { data: result, exp: Date.now() + GEO_CACHE_TTL });
    return result;
  } catch {
    return null;
  }
}

function extractClientIp(request: NextRequest): string {
  return extractTrustedClientIp(request.headers, { trustInternalHeader: true });
}

type LogDetails = Omit<ValidationLog, "id" | "timestamp" | "location">;

function logFireAndForget(
  details: LogDetails,
  locPromise: Promise<ValidationLog["location"] | null>
) {
  const ts = new Date().toISOString();
  void locPromise
    .then((loc) => addLog(loc ? { ...details, location: loc, timestamp: ts } : { ...details, timestamp: ts }))
    .catch(() => addLog({ ...details, timestamp: ts }));
}

function fail(msg: string, status: number) {
  return NextResponse.json({ success: false, status: "failure", message: msg }, { status });
}


export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json({ success: false, status: "failure", message: "Too many requests." }, { status: 429 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid request body.", 400);
    }

    const { key, hwid, discordId: requestDiscordId } = body;

    if (!key || typeof key !== 'string') return fail("Missing key.", 400);
    if (key.length > MAX_KEY_LEN) return fail("Invalid key.", 400);
    if (hwid && (typeof hwid !== 'string' || hwid.length > MAX_HWID_LEN || !HWID_FORMAT_RE.test(hwid))) return fail("Invalid HWID.", 400);
    if (requestDiscordId && (typeof requestDiscordId !== 'string' || !DISCORD_ID_RE.test(requestDiscordId))) {
      return fail("Invalid discordId format.", 400);
    }

    const [blacklist, settings, licenses, products] = await Promise.all([
      getBlacklist(), getSettings(), getLicenses(), getProducts()
    ]);

    const locationPromise = getLocation(ip);

    const baseLogDetails = {
      licenseKey: key,
      ipAddress: ip,
      hwid: hwid || null,
      productName: 'N/A',
      discordId: requestDiscordId || 'N/A',
    };

    const blacklistedIps = new Set(blacklist.ips.map(normalizeIp));
    const blacklistedHwids = new Set(blacklist.hwids);
    const blacklistedUsers = new Set(blacklist.discordIds);

    if (blacklistedIps.has(ip)) {
      logFireAndForget({ ...baseLogDetails, status: 'failure', reason: 'Blacklisted IP' }, locationPromise);
      return fail("Access denied.", 403);
    }

    if (hwid && blacklistedHwids.has(hwid)) {
      logFireAndForget({ ...baseLogDetails, status: 'failure', reason: 'Blacklisted HWID' }, locationPromise);
      return fail("Access denied.", 403);
    }

    if (requestDiscordId && blacklistedUsers.has(requestDiscordId)) {
      logFireAndForget({ ...baseLogDetails, status: 'failure', reason: 'User blacklisted' }, locationPromise);
      return fail("Access denied.", 403);
    }

    if (settings.validationResponse.requireDiscordId && !requestDiscordId) {
      return fail("Missing discordId.", 400);
    }

    const licenseIndex = licenses.findIndex(l => l.key === key);

    if (licenseIndex === -1) {
      logFireAndForget({ ...baseLogDetails, status: 'failure', reason: 'Invalid key' }, locationPromise);
      return fail("Invalid license key.", 403);
    }

    const license = licenses[licenseIndex];
    const product = products.find(p => p.id === license.productId);

    if (!product) {
      logFireAndForget({ ...baseLogDetails, status: 'failure', reason: 'Product not found' }, locationPromise);
      return fail("Associated product not found.", 404);
    }

    const logDetails = {
      licenseKey: key,
      ipAddress: ip,
      hwid: hwid || null,
      productName: product.name || 'N/A',
      discordId: requestDiscordId || license.discordId,
    };

    if (product.hwidProtection && license.maxHwids !== -2 && !hwid) {
      logFireAndForget({ ...logDetails, status: 'failure', reason: 'HWID required but not provided' }, locationPromise);
      return fail("This product requires a hardware ID for validation.", 403);
    }

    if (blacklistedUsers.has(license.discordId)) {
      logFireAndForget({ ...logDetails, status: 'failure', reason: 'License owner blacklisted' }, locationPromise);
      return fail("Access denied.", 403);
    }

    if (requestDiscordId) {
      const isAuthorizedUser = license.discordId === requestDiscordId || (license.subUserDiscordIds || []).includes(requestDiscordId);
      if (!isAuthorizedUser) {
        logFireAndForget({ ...logDetails, status: 'failure', reason: 'User not authorized for this license' }, locationPromise);
        return fail("User is not authorized for this license.", 403);
      }
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      license.status = 'expired';
      licenses[licenseIndex] = license;
      await saveLicenses(licenses);
      logFireAndForget({ ...logDetails, status: 'failure', reason: 'License expired' }, locationPromise);
      return fail("License has expired.", 403);
    }

    if (license.status !== 'active') {
      logFireAndForget({ ...logDetails, status: 'failure', reason: `License inactive (status: ${license.status})` }, locationPromise);
      return fail(`License is not active. Current status: ${license.status}.`, 403);
    }

    let licenseModified = false;
    if (license.maxIps !== -2) {
      const normalizedAllowedIps = new Set(license.allowedIps.map(normalizeIp));
      if (!normalizedAllowedIps.has(ip)) {
        if (license.maxIps !== -1 && license.allowedIps.length >= license.maxIps) {
          logFireAndForget({ ...logDetails, status: 'failure', reason: 'Max IPs reached' }, locationPromise);
          return fail("Maximum number of IPs reached for this license.", 403);
        }
        if (license.maxIps !== -1) {
          license.allowedIps.push(ip);
          licenseModified = true;
        }
      }
    }

    if (product.hwidProtection && hwid && license.maxHwids !== -2) {
      if (license.maxHwids !== -1) {
        if (!license.allowedHwids.includes(hwid)) {
          if (license.allowedHwids.length >= license.maxHwids) {
            logFireAndForget({ ...logDetails, status: 'failure', reason: 'Max HWIDs reached' }, locationPromise);
            return fail("Maximum number of HWIDs reached for this license.", 403);
          }
          license.allowedHwids.push(hwid);
          licenseModified = true;
        }
      }
    }

    const needsUsernameBackfill = !license.discordUsername && license.discordId && license.discordId !== 'unlinked';

    license.validations = (license.validations || 0) + 1;
    licenses[licenseIndex] = license;
    licenseModified = true;

    if (licenseModified) await saveLicenses(licenses);
    logFireAndForget({ ...logDetails, status: 'success' }, locationPromise);

    if (needsUsernameBackfill) {
      fetchDiscordUser(license.discordId).then(async user => {
        if (user) {
          const fresh = await getLicenses();
          const idx = fresh.findIndex(l => l.key === key);
          if (idx !== -1 && !fresh[idx].discordUsername) {
            fresh[idx].discordUsername = user.username;
            await saveLicenses(fresh);
          }
        }
      }).catch(() => {});
    }

    const { validationResponse } = settings;
    const responsePayload: any = { success: true, status: "success" };

    if (validationResponse.customSuccessMessage.enabled && validationResponse.customSuccessMessage.message) {
      responsePayload.message = validationResponse.customSuccessMessage.message;
    }

    if (validationResponse.license.enabled) {
      const info: Record<string, any> = {};
      const f = validationResponse.license.fields;
      if (f.license_key) info.license_key = license.key;
      if (f.status) info.status = license.status;
      if (f.expires_at) info.expires_at = license.expiresAt;
      if (f.issue_date) info.issue_date = license.createdAt;
      if (f.max_ips) info.max_ips = license.maxIps;
      if (f.used_ips) info.used_ips = license.allowedIps;
      if (Object.keys(info).length) responsePayload.license = info;
    }

    if (validationResponse.customer.enabled) {
      const info: Record<string, any> = {};
      const f = validationResponse.customer.fields;
      if (f.id) info.id = license.discordId;
      if (f.discord_id) info.discord_id = license.discordId;
      if (f.customer_since) info.customer_since = license.createdAt;
      if (Object.keys(info).length) responsePayload.customer = info;
    }

    if (validationResponse.product.enabled && product) {
      const info: Record<string, any> = {};
      const f = validationResponse.product.fields;
      if (f.id) info.id = product.id;
      if (f.name) info.name = product.name;
      if (f.enabled) info.enabled = true;
      if (Object.keys(info).length) responsePayload.product = info;
    }

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json({ success: false, status: "failure", message: "An internal server error occurred." }, { status: 500 });
  }
}
