/**
 * Bot-specific data access layer (CommonJS).
 *
 * This file mirrors the locking/atomic-write patterns in data.ts but is
 * kept as plain JS because the Discord bot runs as a standalone Node
 * process without the Next.js/TS build pipeline. If you change locking,
 * caching, or write logic in data.ts, apply the same change here.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { addMonths, addYears } = require('date-fns');

const dataDir = path.resolve(process.cwd(), "data");

const locks = new Map();

async function withFileLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  let release;
  const next = new Promise(r => (release = r));
  locks.set(name, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(name) === next) locks.delete(name);
  }
}

let dirReady = false;
async function ensureDir() {
  if (dirReady) return;
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  dirReady = true;
}

async function readFile(filename, defaultValue) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (!data.trim()) return defaultValue;
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeFileAtomic(filename, defaultValue);
      return defaultValue;
    }
    console.error(`Error reading ${filename}:`, error);
    return defaultValue;
  }
}

async function writeFileAtomic(filename, data) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

const memCache = new Map();
const CACHE_TTL = 2000;

function getCached(key) {
  const entry = memCache.get(key);
  if (entry && Date.now() < entry.exp) return structuredClone(entry.data);
  return null;
}

function setCache(key, data) {
  memCache.set(key, { data, exp: Date.now() + CACHE_TTL });
}

function invalidateCache(key) {
  memCache.delete(key);
}

async function getProducts() {
  const cached = getCached("products.json");
  if (cached) return cached;
  const data = await readFile("products.json", []);
  setCache("products.json", data);
  return data;
}

async function getLicenses() {
  const cached = getCached("licenses.json");
  if (cached) return cached;
  const data = await readFile("licenses.json", []);
  setCache("licenses.json", data);
  return data;
}

async function saveLicenses(licenses) {
  await withFileLock("licenses.json", () => writeFileAtomic("licenses.json", licenses));
  invalidateCache("licenses.json");
}

async function upsertPlatformAccountLink(platform, platformUserId, discordId, discordUsername) {
  const normalizedPlatformUserId = String(platformUserId).trim();
  const normalizedDiscordId = String(discordId).trim();
  const normalizedDiscordUsername = typeof discordUsername === 'string' ? discordUsername.trim() || undefined : undefined;

  return await withFileLock("platform-links.json", async () => {
    const links = await readFile("platform-links.json", []);
    const now = new Date().toISOString();
    const existing = links.find(link =>
      link.platform === platform &&
      (String(link.platformUserId).trim() === normalizedPlatformUserId ||
        String(link.discordId).trim() === normalizedDiscordId)
    );

    const nextLink = {
      platform,
      platformUserId: normalizedPlatformUserId,
      discordId: normalizedDiscordId,
      discordUsername: normalizedDiscordUsername,
      linkedAt: existing?.linkedAt || now,
      updatedAt: now,
    };

    const filteredLinks = links.filter(link =>
      !(
        link.platform === platform &&
        (String(link.platformUserId).trim() === normalizedPlatformUserId ||
          String(link.discordId).trim() === normalizedDiscordId)
      )
    );

    filteredLinks.unshift(nextLink);
    await writeFileAtomic("platform-links.json", filteredLinks);
    invalidateCache("platform-links.json");
    return nextLink;
  });
}

async function createLicense(data) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const newLicense = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId: data.productId,
      platform: data.platform || 'custom',
      platformUserId: data.platformUserId,
      discordId: data.discordId,
      discordUsername: data.discordUsername,
      expiresAt: data.expiresAt,
      source: data.source || 'zeus',
      maxIps: data.maxIps ?? 1,
      maxHwids: data.maxHwids ?? 1,
      subUserDiscordIds: data.subUserDiscordIds || [],
      status: 'active',
      allowedIps: [],
      allowedHwids: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validations: 0,
    };
    licenses.unshift(newLicense);
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");
    return { success: true, license: newLicense };
  });
}

async function updateLicenseStatus(key, status) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) return { success: false, message: "License not found." };
    licenses[idx].status = status;
    licenses[idx].updatedAt = new Date().toISOString();
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");
    return { success: true };
  });
}

async function addSubUserToLicense(key, discordId) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) return { success: false, message: 'License not found.' };
    const license = licenses[idx];
    if (license.discordId === discordId) return { success: false, message: 'User is the owner of this license.' };
    if (!license.subUserDiscordIds) license.subUserDiscordIds = [];
    if (license.subUserDiscordIds.includes(discordId)) return { success: false, message: 'User is already a sub-user on this license.' };
    license.subUserDiscordIds.push(discordId);
    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");
    return { success: true, license };
  });
}

async function removeSubUserFromLicense(key, discordId) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) return { success: false, message: 'License not found.' };
    const license = licenses[idx];
    if (!license.subUserDiscordIds || !license.subUserDiscordIds.includes(discordId)) {
      return { success: false, message: 'Sub-user not found on this license.' };
    }
    license.subUserDiscordIds = license.subUserDiscordIds.filter(id => id !== discordId);
    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");
    return { success: true, license };
  });
}

async function renewLicense(key, duration) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const products = await getProducts();
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) return { success: false, message: "License not found." };

    const license = licenses[idx];
    const product = products.find(p => p.id === license.productId);

    let baseDate = new Date();
    if (license.expiresAt && new Date(license.expiresAt) > baseDate) {
      baseDate = new Date(license.expiresAt);
    }

    let newExpiryDate;
    if (duration === 'lifetime') {
      newExpiryDate = null;
    } else {
      const amount = parseInt(duration.slice(0, -1));
      const unit = duration.slice(-1);
      if (unit === 'm') newExpiryDate = addMonths(baseDate, amount);
      else if (unit === 'y') newExpiryDate = addYears(baseDate, amount);
      else return { success: false, message: "Invalid duration format." };
    }

    license.expiresAt = newExpiryDate ? newExpiryDate.toISOString() : null;
    license.status = 'active';
    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");

    return { success: true, license, productName: product?.name || 'N/A' };
  });
}

async function resetLicenseIdentities(key, type) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) return { success: false, message: 'License not found.' };

    if (type === 'ips') licenses[idx].allowedIps = [];
    else if (type === 'hwids') licenses[idx].allowedHwids = [];
    else return { success: false, message: 'Invalid identity type.' };

    licenses[idx].updatedAt = new Date().toISOString();
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");
    return { success: true, license: licenses[idx] };
  });
}

async function addLicenseIdentity(key, type, value) {
  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) return { success: false, message: 'License not found.' };

    const license = licenses[idx];
    if (type === 'ip') {
      if (license.maxIps === -2) return { success: false, message: 'IP protection is disabled for this license.' };
      if (license.maxIps !== -1 && license.allowedIps.length >= license.maxIps) {
        return { success: false, message: 'Maximum number of IPs reached.' };
      }
      if (license.allowedIps.includes(value)) return { success: false, message: 'This IP is already on the license.' };
      license.allowedIps.push(value);
    } else if (type === 'hwid') {
      if (license.maxHwids === -2) return { success: false, message: 'HWID protection is disabled for this license.' };
      if (license.maxHwids !== -1 && license.allowedHwids.length >= license.maxHwids) {
        return { success: false, message: 'Maximum number of HWIDs reached.' };
      }
      if (license.allowedHwids.includes(value)) return { success: false, message: 'This HWID is already on the license.' };
      license.allowedHwids.push(value);
    } else {
      return { success: false, message: 'Invalid identity type.' };
    }

    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    await writeFileAtomic("licenses.json", licenses);
    invalidateCache("licenses.json");
    return { success: true, license };
  });
}

async function updateLicensesByPlatformId(platform, platformUserId, discordId, discordUsername) {
  if (!platform || !platformUserId || !discordId) {
    return { success: false, message: 'Missing required parameters.' };
  }

  const normalizedPlatformUserId = String(platformUserId).trim();
  const normalizedDiscordId = String(discordId).trim();
  const normalizedDiscordUsername = typeof discordUsername === 'string' ? discordUsername.trim() || undefined : undefined;

  const link = await upsertPlatformAccountLink(
    platform,
    normalizedPlatformUserId,
    normalizedDiscordId,
    normalizedDiscordUsername
  );

  return await withFileLock("licenses.json", async () => {
    const licenses = await readFile("licenses.json", []);
    let updatedCount = 0;

    for (const license of licenses) {
      if (license.platform !== platform || String(license.platformUserId || '').trim() !== normalizedPlatformUserId) {
        continue;
      }

      const nextDiscordUsername = normalizedDiscordUsername || license.discordUsername;
      if (license.discordId === normalizedDiscordId && license.discordUsername === nextDiscordUsername) continue;

      license.discordId = normalizedDiscordId;
      license.discordUsername = nextDiscordUsername;
      license.updatedAt = new Date().toISOString();
      updatedCount++;
    }

    if (updatedCount > 0) {
      await writeFileAtomic("licenses.json", licenses);
      invalidateCache("licenses.json");
    }
    return { success: true, updatedCount, link };
  });
}


async function getVouchers() { return await readFile("vouchers.json", []); }

async function saveVouchers(vouchers) {
  await withFileLock("vouchers.json", () => writeFileAtomic("vouchers.json", vouchers));
}

async function getBlacklist() { return await readFile("blacklist.json", { ips: [], hwids: [], discordIds: [] }); }

const discordUserCache = new Map();
const DISCORD_CACHE_TTL = 3600_000;

async function fetchDiscordUser(userId) {
  if (!userId || userId === 'N/A' || userId === 'unlinked') return null;

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const cached = discordUserCache.get(userId);
  if (cached && Date.now() < cached.exp) return cached.data;

  try {
    const response = await fetch(`https://discord.com/api/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) discordUserCache.set(userId, { data: null, exp: Date.now() + DISCORD_CACHE_TTL });
      return null;
    }

    const userData = await response.json();
    const user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null
    };

    discordUserCache.set(userId, { data: user, exp: Date.now() + DISCORD_CACHE_TTL });
    return user;
  } catch {
    return null;
  }
}


module.exports = {
  getProducts,
  getLicenses,
  saveLicenses,
  createLicense,
  updateLicenseStatus,
  getVouchers,
  saveVouchers,
  getBlacklist,
  fetchDiscordUser,
  addSubUserToLicense,
  removeSubUserFromLicense,
  renewLicense,
  resetLicenseIdentities,
  addLicenseIdentity,
  updateLicensesByPlatformId
};
