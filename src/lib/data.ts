"use server";

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Product, License, ValidationLog, Settings, Blacklist, Customer, Voucher, DailyNewUsersData, NewLicenseDistributionData, DashboardStatsWithData, BotLog, DailyCommandUsage, DailyWebhookCreationsData, PlatformAccountLink, LicensePlatform } from "./types";
import { unstable_noStore as noStore } from 'next/cache';
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";
import { sendWebhook } from "./logging";

const dataDir = path.join(process.cwd(), "data");

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

const locks = new Map<string, Promise<void>>();

async function withFileLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(name) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(r => (release = r));
  locks.set(name, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(name) === next) locks.delete(name);
  }
}

async function readFile<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (!data.trim()) return defaultValue;
    const parsed = JSON.parse(data);

    if (filename === 'blacklist.json' && !parsed.discordIds) {
      parsed.discordIds = [];
      await writeFileAtomic(filename, parsed);
    }

    return parsed as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      await writeFileAtomic(filename, defaultValue);
      return defaultValue;
    }
    console.error(`[CRITICAL] Failed to read/parse ${filename}:`, error);
    return defaultValue;
  }
}

async function writeFileAtomic<T>(filename: string, data: T): Promise<void> {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function updateJsonFile<T>(filename: string, defaultValue: T, updater: (data: T) => T | Promise<T>): Promise<T> {
  return withFileLock(filename, async () => {
    const data = await readFile<T>(filename, defaultValue);
    const updated = await updater(data);
    await writeFileAtomic(filename, updated);
    invalidateCache(filename);
    return updated;
  });
}

const memCache = new Map<string, { data: any; exp: number }>();
const CACHE_TTL = 2000; // 2s

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (entry && Date.now() < entry.exp) return structuredClone(entry.data) as T;
  return null;
}

function setCache(key: string, data: any) {
  memCache.set(key, { data, exp: Date.now() + CACHE_TTL });
}

function invalidateCache(key: string) {
  memCache.delete(key);
}

export async function getProducts(): Promise<Product[]> {
  noStore();
  const cached = getCached<Product[]>("products.json");
  if (cached) return cached;
  const data = await readFile<Product[]>("products.json", []);
  setCache("products.json", data);
  return data;
}

export async function saveProducts(products: Product[]) {
  await withFileLock("products.json", () => writeFileAtomic("products.json", products));
  invalidateCache("products.json");
}

export async function getLicenses(options?: { filterOut?: string[] }): Promise<License[]> {
  noStore();
  let licenses = getCached<License[]>("licenses.json");
  if (!licenses) {
    licenses = await readFile<License[]>("licenses.json", []);
    setCache("licenses.json", licenses);
  }
  if (options?.filterOut) {
    const filterSet = new Set(options.filterOut);
    licenses = licenses.filter(l => !filterSet.has(l.discordId));
  }
  return licenses;
}

export async function saveLicenses(licenses: License[]) {
  await withFileLock("licenses.json", () => writeFileAtomic("licenses.json", licenses));
  invalidateCache("licenses.json");
}

export async function getPlatformAccountLinks(): Promise<PlatformAccountLink[]> {
  noStore();
  // This file is written by the standalone bot process, so bypass the in-memory
  // cache to avoid serving stale link state back to webhook requests.
  return readFile<PlatformAccountLink[]>("platform-links.json", []);
}

export async function savePlatformAccountLinks(links: PlatformAccountLink[]) {
  await withFileLock("platform-links.json", () => writeFileAtomic("platform-links.json", links));
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

  return updateJsonFile<PlatformAccountLink[]>("platform-links.json", [], async (links) => {
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
  return updateJsonFile<License[]>("licenses.json", [], updater);
}

export async function updateProducts(updater: (products: Product[]) => Product[] | Promise<Product[]>): Promise<Product[]> {
  return updateJsonFile<Product[]>("products.json", [], updater);
}

export async function getLogs(): Promise<ValidationLog[]> {
  noStore();
  return await readFile<ValidationLog[]>("logs.json", []);
}

export async function saveLogs(logs: ValidationLog[]) {
  await withFileLock("logs.json", () => writeFileAtomic("logs.json", logs));
}

export async function addLog(log: Omit<ValidationLog, 'id'>) {
  await withFileLock("logs.json", async () => {
    const logs = await readFile<ValidationLog[]>("logs.json", []);
    logs.unshift({ ...log, id: crypto.randomUUID() });
    await writeFileAtomic("logs.json", logs.slice(0, 2000));
  });
}

export async function getBotLogs(): Promise<BotLog[]> {
  noStore();
  return await readFile<BotLog[]>("bot-logs.json", []);
}

export async function saveBotLogs(logs: BotLog[]) {
  await withFileLock("bot-logs.json", () => writeFileAtomic("bot-logs.json", logs));
}

export async function logBotCommand(command: string, userId: string) {
  await withFileLock("bot-logs.json", async () => {
    const logs = await readFile<BotLog[]>("bot-logs.json", []);
    logs.unshift({ command, userId, timestamp: new Date().toISOString() });
    await writeFileAtomic("bot-logs.json", logs.slice(0, 1000));
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
  return await readFile<Voucher[]>("vouchers.json", []);
}

export async function saveVouchers(vouchers: Voucher[]) {
  await withFileLock("vouchers.json", () => writeFileAtomic("vouchers.json", vouchers));
}

export async function getSettings(): Promise<Settings> {
  noStore();
  const cached = getCached<Settings>("settings.json");
  if (cached) return cached;

  const defaultSettings: Settings = {
    apiKey: "",
    panelUrl: "",
    adminApiEnabled: false,
    clientPanel: {
      enabled: false,
      accentColor: "#3b82f6"
    },
    adminApiEndpoints: {
      getLicenses: true,
      createLicense: true,
      updateLicense: true,
      deleteLicense: true,
      updateIdentities: true,
      renewLicense: true,
      manageTeam: true,
      addSubUser: true,
      removeSubUser: true,
    },
    validationResponse: {
      requireDiscordId: true,
      customSuccessMessage: {
        enabled: true,
        message: "License key is valid",
      },
      license: {
        enabled: false,
        fields: {
          license_key: true,
          status: true,
          expires_at: true,
          issue_date: true,
          max_ips: true,
          used_ips: true
        }
      },
      customer: {
        enabled: false,
        fields: {
          id: true,
          discord_id: true,
          customer_since: true
        }
      },
      product: {
        enabled: false,
        fields: {
          id: true,
          name: true,
          enabled: true
        }
      }
    },
    builtByBitWebhookSecret: {
      enabled: false,
      secret: "",
      disableIpProtection: false,
      maxIps: 1,
      enableHwidProtection: false,
      maxHwids: 1,
    },
    builtByBitPlaceholder: {
      enabled: false,
      secret: "",
      disableIpProtection: false,
      maxIps: 1,
      enableHwidProtection: false,
      maxHwids: 1,
    },
    discordBot: {
      enabled: false,
      clientId: "",
      guildId: "",
      botSecret: "",
      adminIds: [],
      commands: {
        viewUser: true,
        checkLicenses: true,
        searchLicense: true,
        deactivate: true,
        createLicense: true,
        renewLicense: true,
        profile: true,
        userLicenses: true,
        manageLicense: true,
        redeem: true,
        linkBuiltbybit: true,
      },
      presence: {
        status: 'online',
        activity: {
          type: 'Watching',
          name: 'licenses',
        }
      }
    },
    logging: {
      enabled: false,
      webhookUrl: "",
      logLicenseCreations: true,
      logLicenseUpdates: true,
      logBotCommands: true,
      logBlacklistActions: true,
      logBuiltByBit: true,
    }
  };

  const settings = await readFile<Settings>("settings.json", defaultSettings);

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
  return settings;
}

export async function saveSettings(settings: Settings) {
  await withFileLock("settings.json", () => writeFileAtomic("settings.json", settings));
  invalidateCache("settings.json");
}

export async function getBlacklist(): Promise<Blacklist> {
  noStore();
  const cached = getCached<Blacklist>("blacklist.json");
  if (cached) return cached;
  const data = await readFile<Blacklist>("blacklist.json", { ips: [], hwids: [], discordIds: [] });
  setCache("blacklist.json", data);
  return data;
}

export async function saveBlacklist(blacklist: Blacklist) {
  await withFileLock("blacklist.json", () => writeFileAtomic("blacklist.json", blacklist));
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

export async function fetchDiscordUser(userId: string): Promise<any | null> {
  noStore();
  if (!userId || userId === 'N/A' || userId === 'unlinked') return null;

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const cached = discordUserCache.get(userId);
  if (cached && Date.now() < cached.exp) return cached.data;

  try {
    const response = await fetch(`https://discord.com/api/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      if (response.status === 404) discordUserCache.set(userId, { data: null, exp: Date.now() + DISCORD_CACHE_TTL });
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

    discordUserCache.set(userId, { data: user, exp: Date.now() + DISCORD_CACHE_TTL });
    return user;
  } catch {
    return null;
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
