"use server";

import crypto from "crypto";
import type { Product, License, ValidationLog, Settings, Blacklist, Customer, Voucher, DailyNewUsersData, NewLicenseDistributionData, DashboardStatsWithData, BotLog, DailyCommandUsage, DailyWebhookCreationsData, PlatformAccountLink, LicensePlatform, StorageMigrationResult, StorageMigrationStatus } from "./types";
import { unstable_noStore as noStore } from 'next/cache';
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";
import { sendWebhook } from "./logging";

const dataStore = require("./data-store");
const { getDefaultSettings } = require("./default-settings") as {
  getDefaultSettings: () => Settings;
};

function cloneData<T>(value: T): T {
  return structuredClone(value);
}

async function readDataFile<T>(filename: string, defaultValue: T): Promise<T> {
  return dataStore.readRecord(filename, defaultValue) as Promise<T>;
}

async function writeDataFile<T>(filename: string, data: T): Promise<void> {
  await dataStore.writeRecord(filename, data);
}

async function updateDataFile<T>(filename: string, defaultValue: T, updater: (data: T) => T | Promise<T>): Promise<T> {
  const updated = await dataStore.updateRecord(filename, defaultValue, updater) as T;
  invalidateCache(filename);
  return updated;
}

const memCache = new Map<string, { data: any; exp: number }>();
const CACHE_TTL = 2000; // 2s

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.exp) {
    memCache.delete(key);
    return null;
  }

  return cloneData(entry.data) as T;
}

function setCache(key: string, data: any) {
  memCache.set(key, { data: cloneData(data), exp: Date.now() + CACHE_TTL });
}

function invalidateCache(key: string) {
  memCache.delete(key);
}

function invalidateAllDataCaches() {
  for (const collection of [
    "settings.json",
    "products.json",
    "licenses.json",
    "platform-links.json",
    "logs.json",
    "bot-logs.json",
    "vouchers.json",
    "blacklist.json",
  ]) {
    invalidateCache(collection);
  }
}

export async function getStorageMigrationStatus(): Promise<StorageMigrationStatus> {
  noStore();
  return dataStore.getStorageMigrationStatus() as Promise<StorageMigrationStatus>;
}

export async function migrateStorageData(): Promise<StorageMigrationResult> {
  const result = await dataStore.migrateStorageData() as StorageMigrationResult;
  if (result.success) {
    invalidateAllDataCaches();
  }
  return result;
}

type DataMutationResult<T, TResult> = {
  data: T;
  changed: boolean;
  result: TResult;
};

async function mutateDataFile<T, TResult>(
  filename: string,
  defaultValue: T,
  mutator: (data: T) => DataMutationResult<T, TResult> | Promise<DataMutationResult<T, TResult>>,
): Promise<TResult> {
  let changed = false;
  const result = await dataStore.mutateRecord(filename, defaultValue, async (data: T) => {
    const mutation = await mutator(data);
    changed = mutation.changed;
    return mutation;
  }) as TResult;

  if (changed) {
    invalidateCache(filename);
  }

  return result;
}

export async function mutateLicenses<TResult>(
  mutator: (licenses: License[]) => DataMutationResult<License[], TResult> | Promise<DataMutationResult<License[], TResult>>,
): Promise<TResult> {
  return mutateDataFile<License[], TResult>("licenses.json", [], mutator);
}

export async function mutateProducts<TResult>(
  mutator: (products: Product[]) => DataMutationResult<Product[], TResult> | Promise<DataMutationResult<Product[], TResult>>,
): Promise<TResult> {
  return mutateDataFile<Product[], TResult>("products.json", [], mutator);
}

export async function getProducts(): Promise<Product[]> {
  noStore();
  const cached = getCached<Product[]>("products.json");
  if (cached) return cached;
  const data = await readDataFile<Product[]>("products.json", []);
  setCache("products.json", data);
  return cloneData(data);
}

export async function saveProducts(products: Product[]) {
  await writeDataFile("products.json", products);
  invalidateCache("products.json");
}

export async function getLicenses(options?: { filterOut?: string[] }): Promise<License[]> {
  noStore();
  let licenses = getCached<License[]>("licenses.json");
  if (!licenses) {
    const data = await readDataFile<License[]>("licenses.json", []);
    setCache("licenses.json", data);
    licenses = cloneData(data);
  }
  if (options?.filterOut) {
    const filterSet = new Set(options.filterOut);
    licenses = licenses.filter((license) => !filterSet.has(license.discordId));
  }
  return licenses;
}

export async function saveLicenses(licenses: License[]) {
  await writeDataFile("licenses.json", licenses);
  invalidateCache("licenses.json");
}

export async function getPlatformAccountLinks(): Promise<PlatformAccountLink[]> {
  noStore();
  // This file is written by the standalone bot process, so bypass the in-memory
  // cache to avoid serving stale link state back to webhook requests.
  return readDataFile<PlatformAccountLink[]>("platform-links.json", []);
}

export async function savePlatformAccountLinks(links: PlatformAccountLink[]) {
  await writeDataFile("platform-links.json", links);
  invalidateCache("platform-links.json");
}

export async function findPlatformAccountLink(
  platform: LicensePlatform,
  platformUserId: string
): Promise<PlatformAccountLink | null> {
  const normalizedPlatformUserId = platformUserId.trim();
  if (!platform || !normalizedPlatformUserId) return null;

  const links = await getPlatformAccountLinks();
  return (
    links.find(
      (link) =>
        link.platform === platform &&
        link.platformUserId.trim() === normalizedPlatformUserId
    ) ?? null
  );
}

export async function upsertPlatformAccountLink(input: {
  platform: LicensePlatform;
  platformUserId: string;
  discordId: string;
  discordUsername?: string;
}): Promise<PlatformAccountLink> {
  const normalizedPlatformUserId = input.platformUserId.trim();
  const normalizedDiscordId = input.discordId.trim();
  const normalizedDiscordUsername = input.discordUsername?.trim() || undefined;

  return updateDataFile<PlatformAccountLink[]>("platform-links.json", [], async (links) => {
    const now = new Date().toISOString();
    const existing = links.find(
      (link) =>
        link.platform === input.platform &&
        (link.platformUserId.trim() === normalizedPlatformUserId ||
          link.discordId.trim() === normalizedDiscordId)
    );

    const nextLink: PlatformAccountLink = {
      platform: input.platform,
      platformUserId: normalizedPlatformUserId,
      discordId: normalizedDiscordId,
      discordUsername: normalizedDiscordUsername,
      linkedAt: existing?.linkedAt ?? now,
      updatedAt: now,
    };

    const filteredLinks = links.filter(
      (link) =>
        !(
          link.platform === input.platform &&
          (link.platformUserId.trim() === normalizedPlatformUserId ||
            link.discordId.trim() === normalizedDiscordId)
        )
    );

    filteredLinks.unshift(nextLink);
    return filteredLinks;
  }).then((links) => {
    return links.find(
      (link) =>
        link.platform === input.platform &&
        link.platformUserId.trim() === normalizedPlatformUserId
    ) as PlatformAccountLink;
  });
}

export async function updateLicenses(updater: (licenses: License[]) => License[] | Promise<License[]>): Promise<License[]> {
  return updateDataFile<License[]>("licenses.json", [], updater);
}

export async function updateProducts(updater: (products: Product[]) => Product[] | Promise<Product[]>): Promise<Product[]> {
  return updateDataFile<Product[]>("products.json", [], updater);
}

export async function getLogs(): Promise<ValidationLog[]> {
  noStore();
  return await readDataFile<ValidationLog[]>("logs.json", []);
}

export async function saveLogs(logs: ValidationLog[]) {
  await writeDataFile("logs.json", logs);
}

export async function addLog(log: Omit<ValidationLog, 'id'>) {
  await updateDataFile<ValidationLog[]>("logs.json", [], (logs) => {
    logs.unshift({ ...log, id: crypto.randomUUID() });
    return logs.slice(0, 2000);
  });
}

export async function getBotLogs(): Promise<BotLog[]> {
  noStore();
  return await readDataFile<BotLog[]>("bot-logs.json", []);
}

export async function saveBotLogs(logs: BotLog[]) {
  await writeDataFile("bot-logs.json", logs);
}

export async function logBotCommand(command: string, userId: string) {
  await updateDataFile<BotLog[]>("bot-logs.json", [], (logs) => {
    logs.unshift({ command, userId, timestamp: new Date().toISOString() });
    return logs.slice(0, 1000);
  });

  // Fire-and-forget: don't block on settings/user fetch for webhook
  void (async () => {
    try {
      const settings = await getSettings();
      if (settings.logging.enabled && settings.logging.logBotCommands) {
        const user = await fetchDiscordUser(userId);
        sendWebhook({
          title: 'Bot Command Executed',
          description: `User ${user?.username || 'Unknown'} (\`${userId}\`) executed the command.`,
          timestamp: new Date().toISOString(),
          fields: [
            { name: 'Command', value: `\`/${command}\``, inline: true },
            { name: 'User', value: `${user?.username || 'Unknown'} (\`${userId}\`)`, inline: true },
          ]
        }, settings.logging);
      }
    } catch {}
  })();
}

export async function getVouchers(): Promise<Voucher[]> {
  noStore();
  return await readDataFile<Voucher[]>("vouchers.json", []);
}

export async function saveVouchers(vouchers: Voucher[]) {
  await writeDataFile("vouchers.json", vouchers);
}

export async function getSettings(): Promise<Settings> {
  noStore();
  const cached = getCached<Settings>("settings.json");
  if (cached) return cached;

  const defaultSettings = getDefaultSettings();

  const settings = await readDataFile<Settings>("settings.json", defaultSettings);

  const mergeDefaults = (target: any, source: any) => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDefaults(target[key], source[key]);
      } else if (target[key] === undefined) {
        Object.assign(target, { [key]: source[key] });
      }
    }
  };

  mergeDefaults(settings, defaultSettings);
  setCache("settings.json", settings);
  return cloneData(settings);
}

export async function saveSettings(settings: Settings) {
  await writeDataFile("settings.json", settings);
  invalidateCache("settings.json");
}

export async function getBlacklist(): Promise<Blacklist> {
  noStore();
  const cached = getCached<Blacklist>("blacklist.json");
  if (cached) return cached;
  const data = await readDataFile<Blacklist>("blacklist.json", { ips: [], hwids: [], discordIds: [] });
  setCache("blacklist.json", data);
  return cloneData(data);
}

export async function saveBlacklist(blacklist: Blacklist) {
  await writeDataFile("blacklist.json", blacklist);
  invalidateCache("blacklist.json");
}


export async function getDashboardStats(): Promise<DashboardStatsWithData> {
  noStore();
  const [products, licenses, logs] = await Promise.all([getProducts(), getLicenses(), getLogs()]);

  const now = new Date();
  const sevenDaysAgo = subDays(now, 6);
  const fourteenDaysAgo = subDays(now, 13);
  const intervalStart = startOfDay(sevenDaysAgo);

  const totalValidations = logs.length;
  const successfulValidations = logs.filter(log => log.status === 'success').length;

  const intervalStartMs = intervalStart.getTime();
  const prevStartMs = startOfDay(fourteenDaysAgo).getTime();

  let validationsLast7Days = 0;
  let validationsPrevious7Days = 0;
  for (const l of logs) {
    const t = new Date(l.timestamp).getTime();
    if (t >= intervalStartMs) validationsLast7Days++;
    else if (t >= prevStartMs) validationsPrevious7Days++;
  }

  let validationChangePercent = 0;
  if (validationsPrevious7Days > 0) {
    validationChangePercent = ((validationsLast7Days - validationsPrevious7Days) / validationsPrevious7Days) * 100;
  } else if (validationsLast7Days > 0) {
    validationChangePercent = 100;
  }

  const interval = { start: intervalStart, end: now };

  const activeLicenses = licenses.filter(l => {
    if (l.status !== 'active') return false;
    if (l.expiresAt && new Date(l.expiresAt) < now) return false;
    return true;
  }).length;

  const newLicensesLast7Days = licenses.filter(l => new Date(l.createdAt) >= interval.start);

  const dailyNewUsers: DailyNewUsersData[] = eachDayOfInterval(interval).map(day => ({
    date: format(day, "MMM d"),
    users: 0,
  }));
  const dailyNewUsersMap = new Map(dailyNewUsers.map(d => [d.date, d]));

  const seenUsers = new Set<string>();
  const sortedByCreation = [...licenses].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const l of sortedByCreation) {
    if (!l.discordId || seenUsers.has(l.discordId)) continue;
    seenUsers.add(l.discordId);
    const creationDate = new Date(l.createdAt);
    if (creationDate >= interval.start) {
      const formattedDate = format(startOfDay(creationDate), "MMM d");
      const dayData = dailyNewUsersMap.get(formattedDate);
      if (dayData) dayData.users++;
    }
  }

  const allUsersBefore7Days = new Set(
    licenses.filter(l => new Date(l.createdAt) < interval.start).map(l => l.discordId)
  );

  let newUsersWithNewLicense = 0;
  let existingUsersWithNewLicense = 0;
  const seenNewUsers = new Set<string>();

  for (const l of newLicensesLast7Days) {
    if (allUsersBefore7Days.has(l.discordId)) {
      existingUsersWithNewLicense++;
    } else if (!seenNewUsers.has(l.discordId)) {
      seenNewUsers.add(l.discordId);
      newUsersWithNewLicense++;
    } else {
      existingUsersWithNewLicense++;
    }
  }

  const newLicenseDistribution: NewLicenseDistributionData[] = [
    { name: 'New Customers', value: newUsersWithNewLicense, fill: 'hsl(var(--chart-1))' },
    { name: 'Existing Customers', value: existingUsersWithNewLicense, fill: 'hsl(var(--chart-2))' },
  ];

  const dailyWebhookCreations: DailyWebhookCreationsData[] = eachDayOfInterval(interval).map(day => ({
    date: format(day, "MMM d"),
    creations: 0,
  }));
  const dailyWebhookCreationsMap = new Map(dailyWebhookCreations.map(d => [d.date, d]));

  for (const l of licenses) {
    if (!l.source?.startsWith('builtbybit') || new Date(l.createdAt) < interval.start) continue;
    const formattedDate = format(startOfDay(new Date(l.createdAt)), "MMM d");
    const dayData = dailyWebhookCreationsMap.get(formattedDate);
    if (dayData) dayData.creations++;
  }

  return {
    totalProducts: products.length,
    totalLicenses: licenses.length,
    activeLicenses,
    totalValidations,
    successfulValidations,
    validationChangePercent,
    dailyNewUsers,
    newLicenseDistribution,
    dailyWebhookCreations,
    logs,
    licenses,
  };
}


const discordUserCache = new Map<string, { data: any; exp: number }>();
const DISCORD_CACHE_TTL = 3600_000; // 1hr
const DISCORD_CACHE_MAX = 2000;
const DISCORD_FETCH_TIMEOUT_MS = 2000;

function pruneCache(cache: Map<string, unknown>, maxSize: number) {
  if (cache.size < maxSize) {
    return;
  }

  const removals = Math.max(1, Math.floor(maxSize / 4));
  let removed = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    removed++;
    if (removed >= removals) {
      break;
    }
  }
}

export async function fetchDiscordUser(userId: string): Promise<any | null> {
  noStore();
  if (!userId || userId === 'N/A' || userId === 'unlinked' || !/^\d{15,22}$/.test(userId)) return null;

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const cached = discordUserCache.get(userId);
  if (cached && Date.now() < cached.exp) return cached.data;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISCORD_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`https://discord.com/api/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        pruneCache(discordUserCache, DISCORD_CACHE_MAX);
        discordUserCache.set(userId, { data: null, exp: Date.now() + DISCORD_CACHE_TTL });
      }
      return null;
    }

    const userData: any = await response.json();
    const user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=random`,
      email: userData.email || undefined,
    };

    pruneCache(discordUserCache, DISCORD_CACHE_MAX);
    discordUserCache.set(userId, { data: user, exp: Date.now() + DISCORD_CACHE_TTL });
    return user;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function batchFetchDiscordUsers(userIds: string[], concurrency = 5): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  let i = 0;
  async function next() {
    while (i < userIds.length) {
      const id = userIds[i++];
      const user = await fetchDiscordUser(id);
      if (user) results.set(user.id, user);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, userIds.length) }, () => next()));
  return results;
}

export async function getCustomerProfile(userId: string): Promise<Customer | null> {
  noStore();
  const licenses = await getLicenses();
  const discordUser = await fetchDiscordUser(userId);

  const ownedLicenses = licenses.filter(l => l.discordId === userId);
  const subUserOnLicenses = licenses.filter(l => l.subUserDiscordIds?.includes(userId));

  if (ownedLicenses.length === 0 && subUserOnLicenses.length === 0) return null;

  const firstOwnedLicense = ownedLicenses[0];
  const isOwner = ownedLicenses.length > 0;
  const username = discordUser?.username || firstOwnedLicense?.discordUsername || userId;
  const builtByBitId = ownedLicenses.find(l => l.platform === 'builtbybit' && l.platformUserId)?.platformUserId;

  return {
    id: userId,
    discordId: userId,
    discordUsername: username,
    avatarUrl: discordUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
    isOwner,
    ownedLicenseCount: ownedLicenses.length,
    subUserLicenseCount: subUserOnLicenses.length,
    email: isOwner ? firstOwnedLicense?.email : undefined,
    builtByBitId,
  };
}

export async function getAllUsers(): Promise<Customer[]> {
  noStore();
  const licenses = await getLicenses();
  const allUserIds = new Set<string>();

  for (const l of licenses) {
    if (l.discordId && l.discordId !== 'unlinked') allUserIds.add(l.discordId);
    l.subUserDiscordIds?.forEach(id => { if (id) allUserIds.add(id); });
  }

  const uniqueUserIds = Array.from(allUserIds);
  const discordUserMap = await batchFetchDiscordUsers(uniqueUserIds);

  const ownerMap = new Map<string, License[]>();
  const subUserMap = new Map<string, License[]>();
  for (const l of licenses) {
    if (l.discordId && l.discordId !== 'unlinked') {
      const arr = ownerMap.get(l.discordId) || [];
      arr.push(l);
      ownerMap.set(l.discordId, arr);
    }
    for (const subId of (l.subUserDiscordIds || [])) {
      if (subId) {
        const arr = subUserMap.get(subId) || [];
        arr.push(l);
        subUserMap.set(subId, arr);
      }
    }
  }

  const customers: Customer[] = uniqueUserIds.map(userId => {
    const ownedLicenses = ownerMap.get(userId) || [];
    const subUserOnLicenses = subUserMap.get(userId) || [];
    const discordUser = discordUserMap.get(userId);
    const firstOwnedLicense = ownedLicenses[0];
    const isOwner = ownedLicenses.length > 0;
    const username = discordUser?.username || firstOwnedLicense?.discordUsername || subUserOnLicenses[0]?.discordUsername || userId;
    const builtByBitId = ownedLicenses.find(l => l.platform === 'builtbybit' && l.platformUserId)?.platformUserId;

    return {
      id: userId,
      discordId: userId,
      discordUsername: username,
      avatarUrl: discordUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
      isOwner,
      ownedLicenseCount: ownedLicenses.length,
      subUserLicenseCount: subUserOnLicenses.length,
      email: isOwner ? firstOwnedLicense?.email : undefined,
      builtByBitId,
    };
  });

  return customers.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return (a.discordUsername || '').localeCompare(b.discordUsername || '');
  });
}


export async function getCommandUsageData(): Promise<DailyCommandUsage[]> {
  noStore();
  const botLogs = await getBotLogs();
  const last7Days = eachDayOfInterval({
    start: startOfDay(subDays(new Date(), 6)),
    end: startOfDay(new Date()),
  });

  const dailyUsage: DailyCommandUsage[] = last7Days.map(day => ({
    date: format(day, "MMM d"),
    commands: 0,
  }));
  const usageMap = new Map(dailyUsage.map(d => [d.date, d]));

  for (const log of botLogs) {
    const logDate = startOfDay(new Date(log.timestamp));
    const dayData = usageMap.get(format(logDate, "MMM d"));
    if (dayData) dayData.commands++;
  }

  return dailyUsage;
}
