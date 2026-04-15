import { NextResponse, NextRequest } from "next/server";
import { mutateLicenses, addLog, getProducts, getBlacklist, getSettings, fetchDiscordUser } from "@/lib/data";
import { extractClientIp as extractTrustedClientIp, normalizeIp } from "@/lib/utils";
import type { License, Product, ValidationLog } from "@/lib/types";

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

type LogDetails = Omit<ValidationLog, "id" | "timestamp" | "location" | "status" | "reason">;

function logFireAndForget(
  details: LogDetails & Pick<ValidationLog, "status"> & Partial<Pick<ValidationLog, "reason">>,
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

type ValidationFailureResult = {
  ok: false;
  status: number;
  message: string;
  reason: string;
  logDetails: LogDetails;
};

type ValidationSuccessResult = {
  ok: true;
  license: License;
  product: Product;
  logDetails: LogDetails;
  needsUsernameBackfill: boolean;
};


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

    const [blacklist, settings, products] = await Promise.all([
      getBlacklist(), getSettings(), getProducts()
    ]);
    const productMap = new Map(products.map((product) => [product.id, product]));

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

    const validationResult = await mutateLicenses<ValidationFailureResult | ValidationSuccessResult>((licenses) => {
      const licenseIndex = licenses.findIndex((license) => license.key === key);
      if (licenseIndex === -1) {
        return {
          data: licenses,
          changed: false,
          result: {
            ok: false,
            status: 403,
            message: "Invalid license key.",
            reason: "Invalid key",
            logDetails: baseLogDetails,
          },
        };
      }

      const license = licenses[licenseIndex];
      const product = productMap.get(license.productId);
      if (!product) {
        return {
          data: licenses,
          changed: false,
          result: {
            ok: false,
            status: 404,
            message: "Associated product not found.",
            reason: "Product not found",
            logDetails: baseLogDetails,
          },
        };
      }

      const logDetails: LogDetails = {
        licenseKey: key,
        ipAddress: ip,
        hwid: hwid || null,
        productName: product.name || "N/A",
        discordId: requestDiscordId || license.discordId,
      };

      if (product.hwidProtection && license.maxHwids !== -2 && !hwid) {
        return {
          data: licenses,
          changed: false,
          result: {
            ok: false,
            status: 403,
            message: "This product requires a hardware ID for validation.",
            reason: "HWID required but not provided",
            logDetails,
          },
        };
      }

      if (blacklistedUsers.has(license.discordId)) {
        return {
          data: licenses,
          changed: false,
          result: {
            ok: false,
            status: 403,
            message: "Access denied.",
            reason: "License owner blacklisted",
            logDetails,
          },
        };
      }

      if (requestDiscordId) {
        const isAuthorizedUser =
          license.discordId === requestDiscordId || (license.subUserDiscordIds || []).includes(requestDiscordId);
        if (!isAuthorizedUser) {
          return {
            data: licenses,
            changed: false,
            result: {
              ok: false,
              status: 403,
              message: "User is not authorized for this license.",
              reason: "User not authorized for this license",
              logDetails,
            },
          };
        }
      }

      const now = new Date();
      const nowIso = now.toISOString();
      if (license.expiresAt && new Date(license.expiresAt) < now) {
        const nextLicense =
          license.status === "expired"
            ? license
            : {
                ...license,
                status: "expired" as const,
                updatedAt: nowIso,
              };

        if (nextLicense !== license) {
          licenses[licenseIndex] = nextLicense;
        }

        return {
          data: licenses,
          changed: nextLicense !== license,
          result: {
            ok: false,
            status: 403,
            message: "License has expired.",
            reason: "License expired",
            logDetails,
          },
        };
      }

      if (license.status !== "active") {
        return {
          data: licenses,
          changed: false,
          result: {
            ok: false,
            status: 403,
            message: `License is not active. Current status: ${license.status}.`,
            reason: `License inactive (status: ${license.status})`,
            logDetails,
          },
        };
      }

      const nextLicense: License = {
        ...license,
        allowedIps: [...license.allowedIps],
        allowedHwids: [...license.allowedHwids],
        validations: (license.validations || 0) + 1,
        updatedAt: nowIso,
      };

      if (license.maxIps !== -2) {
        const normalizedAllowedIps = new Set(nextLicense.allowedIps.map(normalizeIp));
        if (!normalizedAllowedIps.has(ip)) {
          if (license.maxIps !== -1 && nextLicense.allowedIps.length >= license.maxIps) {
            return {
              data: licenses,
              changed: false,
              result: {
                ok: false,
                status: 403,
                message: "Maximum number of IPs reached for this license.",
                reason: "Max IPs reached",
                logDetails,
              },
            };
          }

          if (license.maxIps !== -1) {
            nextLicense.allowedIps.push(ip);
          }
        }
      }

      if (product.hwidProtection && hwid && license.maxHwids !== -2 && license.maxHwids !== -1) {
        if (!nextLicense.allowedHwids.includes(hwid)) {
          if (nextLicense.allowedHwids.length >= license.maxHwids) {
            return {
              data: licenses,
              changed: false,
              result: {
                ok: false,
                status: 403,
                message: "Maximum number of HWIDs reached for this license.",
                reason: "Max HWIDs reached",
                logDetails,
              },
            };
          }

          nextLicense.allowedHwids.push(hwid);
        }
      }

      licenses[licenseIndex] = nextLicense;
      return {
        data: licenses,
        changed: true,
        result: {
          ok: true,
          license: nextLicense,
          product,
          logDetails,
          needsUsernameBackfill: !nextLicense.discordUsername && nextLicense.discordId !== "unlinked",
        },
      };
    });

    if (!validationResult.ok) {
      logFireAndForget(
        { ...validationResult.logDetails, status: "failure", reason: validationResult.reason },
        locationPromise,
      );
      return fail(validationResult.message, validationResult.status);
    }

    const { license, product, logDetails, needsUsernameBackfill } = validationResult;
    logFireAndForget({ ...logDetails, status: "success" }, locationPromise);

    if (needsUsernameBackfill) {
      void fetchDiscordUser(license.discordId)
        .then(async (user) => {
          if (!user) {
            return;
          }

          await mutateLicenses<void>((licenses) => {
            const idx = licenses.findIndex((candidate) => candidate.key === key);
            if (idx === -1 || licenses[idx].discordUsername) {
              return { data: licenses, changed: false, result: undefined };
            }

            licenses[idx] = {
              ...licenses[idx],
              discordUsername: user.username,
              updatedAt: new Date().toISOString(),
            };

            return { data: licenses, changed: true, result: undefined };
          });
        })
        .catch(() => {});
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
