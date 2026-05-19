/**
 * Bot-specific data access layer (CommonJS).
 *
 * This file is kept as plain JS because the Discord bot runs as a standalone
 * Node process without the Next.js/TS build pipeline.
 */
const crypto = require('crypto');
const { addMonths, addYears } = require('date-fns');
const dataStore = require('./data-store');
const { getDefaultSettings } = require('./default-settings');

async function readDataFile(filename, defaultValue) {
  return dataStore.readRecord(filename, defaultValue);
}

async function writeDataFile(filename, data) {
  await dataStore.writeRecord(filename, data);
}

async function mutateDataFile(filename, defaultValue, mutator) {
  let changed = false;
  const result = await dataStore.mutateRecord(filename, defaultValue, async (data) => {
    const mutation = await mutator(data);
    changed = mutation.changed;
    return mutation;
  });
  if (changed) invalidateCache(filename);
  return result;
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
  const data = await readDataFile("products.json", []);
  setCache("products.json", data);
  return data;
}

async function getLicenses() {
  const cached = getCached("licenses.json");
  if (cached) return cached;
  const data = await readDataFile("licenses.json", []);
  setCache("licenses.json", data);
  return data;
}

async function saveLicenses(licenses) {
  await writeDataFile("licenses.json", licenses);
  invalidateCache("licenses.json");
}

async function upsertPlatformAccountLink(platform, platformUserId, discordId, discordUsername) {
  const normalizedPlatformUserId = String(platformUserId).trim();
  const normalizedDiscordId = String(discordId).trim();
  const normalizedDiscordUsername = typeof discordUsername === 'string' ? discordUsername.trim() || undefined : undefined;

  return await mutateDataFile("platform-links.json", [], async (links) => {
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
    return { data: filteredLinks, changed: true, result: nextLink };
  });
}

async function createLicense(data) {
  return await mutateDataFile("licenses.json", [], async (licenses) => {
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
    return { data: licenses, changed: true, result: { success: true, license: newLicense } };
  });
}

async function updateLicenseStatus(key, status) {
  return await mutateDataFile("licenses.json", [], async (licenses) => {
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) {
      return { data: licenses, changed: false, result: { success: false, message: "License not found." } };
    }
    licenses[idx].status = status;
    licenses[idx].updatedAt = new Date().toISOString();
    return { data: licenses, changed: true, result: { success: true } };
  });
}

async function addSubUserToLicense(key, discordId) {
  return await mutateDataFile("licenses.json", [], async (licenses) => {
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) {
      return { data: licenses, changed: false, result: { success: false, message: 'License not found.' } };
    }
    const license = licenses[idx];
    if (license.discordId === discordId) {
      return { data: licenses, changed: false, result: { success: false, message: 'User is the owner of this license.' } };
    }
    if (!license.subUserDiscordIds) license.subUserDiscordIds = [];
    if (license.subUserDiscordIds.includes(discordId)) {
      return { data: licenses, changed: false, result: { success: false, message: 'User is already a sub-user on this license.' } };
    }
    license.subUserDiscordIds.push(discordId);
    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    return { data: licenses, changed: true, result: { success: true, license } };
  });
}

async function removeSubUserFromLicense(key, discordId) {
  return await mutateDataFile("licenses.json", [], async (licenses) => {
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) {
      return { data: licenses, changed: false, result: { success: false, message: 'License not found.' } };
    }
    const license = licenses[idx];
    if (!license.subUserDiscordIds || !license.subUserDiscordIds.includes(discordId)) {
      return { data: licenses, changed: false, result: { success: false, message: 'Sub-user not found on this license.' } };
    }
    license.subUserDiscordIds = license.subUserDiscordIds.filter(id => id !== discordId);
    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    return { data: licenses, changed: true, result: { success: true, license } };
  });
}

async function renewLicense(key, duration) {
  const products = await getProducts();
  return await mutateDataFile("licenses.json", [], async (licenses) => {
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) {
      return { data: licenses, changed: false, result: { success: false, message: "License not found." } };
    }

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
      else {
        return { data: licenses, changed: false, result: { success: false, message: "Invalid duration format." } };
      }
    }

    license.expiresAt = newExpiryDate ? newExpiryDate.toISOString() : null;
    license.status = 'active';
    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;

    return { data: licenses, changed: true, result: { success: true, license, productName: product?.name || 'N/A' } };
  });
}

async function resetLicenseIdentities(key, type) {
  return await mutateDataFile("licenses.json", [], async (licenses) => {
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) {
      return { data: licenses, changed: false, result: { success: false, message: 'License not found.' } };
    }

    if (type === 'ips') licenses[idx].allowedIps = [];
    else if (type === 'hwids') licenses[idx].allowedHwids = [];
    else {
      return { data: licenses, changed: false, result: { success: false, message: 'Invalid identity type.' } };
    }

    licenses[idx].updatedAt = new Date().toISOString();
    return { data: licenses, changed: true, result: { success: true, license: licenses[idx] } };
  });
}

async function addLicenseIdentity(key, type, value) {
  return await mutateDataFile("licenses.json", [], async (licenses) => {
    const idx = licenses.findIndex(l => l.key === key);
    if (idx === -1) {
      return { data: licenses, changed: false, result: { success: false, message: 'License not found.' } };
    }

    const license = licenses[idx];
    if (type === 'ip') {
      if (license.maxIps === -2) {
        return { data: licenses, changed: false, result: { success: false, message: 'IP protection is disabled for this license.' } };
      }
      if (license.maxIps !== -1 && license.allowedIps.length >= license.maxIps) {
        return { data: licenses, changed: false, result: { success: false, message: 'Maximum number of IPs reached.' } };
      }
      if (license.allowedIps.includes(value)) {
        return { data: licenses, changed: false, result: { success: false, message: 'This IP is already on the license.' } };
      }
      license.allowedIps.push(value);
    } else if (type === 'hwid') {
      if (license.maxHwids === -2) {
        return { data: licenses, changed: false, result: { success: false, message: 'HWID protection is disabled for this license.' } };
      }
      if (license.maxHwids !== -1 && license.allowedHwids.length >= license.maxHwids) {
        return { data: licenses, changed: false, result: { success: false, message: 'Maximum number of HWIDs reached.' } };
      }
      if (license.allowedHwids.includes(value)) {
        return { data: licenses, changed: false, result: { success: false, message: 'This HWID is already on the license.' } };
      }
      license.allowedHwids.push(value);
    } else {
      return { data: licenses, changed: false, result: { success: false, message: 'Invalid identity type.' } };
    }

    license.updatedAt = new Date().toISOString();
    licenses[idx] = license;
    return { data: licenses, changed: true, result: { success: true, license } };
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

  return await mutateDataFile("licenses.json", [], async (licenses) => {
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

    return {
      data: licenses,
      changed: updatedCount > 0,
      result: { success: true, updatedCount, link },
    };
  });
}


async function getVouchers() { return await readDataFile("vouchers.json", []); }

async function saveVouchers(vouchers) {
  await writeDataFile("vouchers.json", vouchers);
}

function mergeDefaults(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      mergeDefaults(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
}

async function getSettings() {
  const cached = getCached("settings.json");
  if (cached) return cached;

  const defaultSettings = getDefaultSettings();
  const settings = await readDataFile("settings.json", defaultSettings);
  mergeDefaults(settings, defaultSettings);
  setCache("settings.json", settings);
  return structuredClone(settings);
}

async function getBlacklist() { return await readDataFile("blacklist.json", { ips: [], hwids: [], discordIds: [] }); }

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
  getSettings,
  getBlacklist,
  fetchDiscordUser,
  addSubUserToLicense,
  removeSubUserFromLicense,
  renewLicense,
  resetLicenseIdentities,
  addLicenseIdentity,
  updateLicensesByPlatformId
};
