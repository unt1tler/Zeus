
"use server";

import fs from "fs/promises";
import path from "path";
import type { Product, License, ValidationLog, Settings, Blacklist, Customer, Voucher, DailyNewUsersData, NewLicenseDistributionData, DashboardStats, BotLog, DailyCommandUsage, BuiltByBitWebhookSettings, DailyWebhookCreationsData, WebhookLoggingSettings, ClientPanelSettings } from "./types";
import { unstable_noStore as noStore } from 'next/cache';
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";
import { sendWebhook } from "./logging";

const dataDir = path.join(process.cwd(), "data");

async function ensureDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readFile<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (data === "") return defaultValue;
    let parsedData = JSON.parse(data);
    
     if (filename === 'blacklist.json' && !parsedData.discordIds) {
      parsedData.discordIds = [];
      await writeFile(filename, parsedData);
    }
    
    return parsedData as T;
  } catch (error) {
    await writeFile(filename, defaultValue);
    return defaultValue;
  }
}

async function writeFile<T>(filename: string, data: T): Promise<void> {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function getProducts() { noStore(); return await readFile<Product[]>("products.json", []);}
export async function saveProducts(products: Product[]) { await writeFile("products.json", products);}

export async function getLicenses(options?: { filterOut?: string[] }) { 
    noStore(); 
    let licenses = await readFile<License[]>("licenses.json", []);
    if (options?.filterOut) {
        licenses = licenses.filter(l => !options.filterOut?.includes(l.discordId));
    }
    return licenses;
}
export async function saveLicenses(licenses: License[]) { await writeFile("licenses.json", licenses);}

export async function getLogs() { noStore(); return await readFile<ValidationLog[]>("logs.json", []);}
export async function saveLogs(logs: ValidationLog[]) { await writeFile("logs.json", logs);}
export async function addLog(log: Omit<ValidationLog, 'id'>) {
    const logs = await getLogs();
    const newLog: ValidationLog = { ...log, id: crypto.randomUUID() };
    logs.unshift(newLog);
    await saveLogs(logs.slice(0, 500));
}

export async function getBotLogs() { noStore(); return await readFile<BotLog[]>("bot-logs.json", []);}
export async function saveBotLogs(logs: BotLog[]) { await writeFile("bot-logs.json", logs);}
export async function logBotCommand(command: string, userId: string) {
    const logs = await getBotLogs();
    logs.unshift({ command, userId, timestamp: new Date().toISOString() });
    await saveBotLogs(logs.slice(0, 1000));
    
    const settings = await getSettings();
    if(settings.logging.enabled && settings.logging.logBotCommands) {
        const user = await fetchDiscordUser(userId);
        await sendWebhook({
            title: 'Bot Command Executed',
            description: `User ${user?.username || 'Unknown'} (\`${userId}\`) executed the command.`,
            timestamp: new Date().toISOString(),
            fields: [
                { name: 'Command', value: `\`/${command}\``, inline: true },
                { name: 'User', value: `${user?.username || 'Unknown'} (\`${userId}\`)`, inline: true },
            ]
        })
    }
}

export async function getVouchers() { noStore(); return await readFile<Voucher[]>("vouchers.json", []);}
export async function saveVouchers(vouchers: Voucher[]) { await writeFile("vouchers.json", vouchers);}

export async function getSettings(): Promise<Settings> {
  noStore();
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

  const mergeDeep = (target: any, source: any) => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        if (target[key] === undefined) {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
  }

  mergeDeep(settings, defaultSettings);
  
  return settings;
}
export async function saveSettings(settings: Settings) { await writeFile("settings.json", settings);}

export async function getBlacklist() { noStore(); return await readFile<Blacklist>("blacklist.json", { ips: [], hwids: [], discordIds: [] });}
export async function saveBlacklist(blacklist: Blacklist) { await writeFile("blacklist.json", blacklist);}


export async function getDashboardStats(): Promise<DashboardStats> {
    noStore();
    const products = await getProducts();
    const licenses = await getLicenses();
    const logs = await getLogs();

    const totalValidations = logs.length;
    const successfulValidations = logs.filter(log => log.status === 'success').length;
    
    const now = new Date();
    const sevenDaysAgo = subDays(now, 6);
    const fourteenDaysAgo = subDays(now, 13);

    const validationsLast7Days = logs.filter(l => new Date(l.timestamp) >= startOfDay(sevenDaysAgo)).length;
    const validationsPrevious7Days = logs.filter(l => {
        const logDate = new Date(l.timestamp);
        return logDate >= startOfDay(fourteenDaysAgo) && logDate < startOfDay(sevenDaysAgo);
    }).length;
    
    let validationChangePercent = 0;
    if (validationsPrevious7Days > 0) {
        validationChangePercent = ((validationsLast7Days - validationsPrevious7Days) / validationsPrevious7Days) * 100;
    } else if (validationsLast7Days > 0) {
        validationChangePercent = 100;
    }
    
    const interval = { start: startOfDay(sevenDaysAgo), end: now };

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
    
    const seenUsers = new Set<string>();
    licenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .forEach(l => {
            if (l.discordId && !seenUsers.has(l.discordId)) {
                seenUsers.add(l.discordId);
                const creationDate = new Date(l.createdAt);
                if (creationDate >= interval.start) {
                    const formattedDate = format(startOfDay(creationDate), "MMM d");
                    const dayData = dailyNewUsers.find(d => d.date === formattedDate);
                    if (dayData) {
                        dayData.users++;
                    }
                }
            }
        });

    const allUsersBefore7Days = new Set(
        licenses
            .filter(l => new Date(l.createdAt) < interval.start)
            .map(l => l.discordId)
    );

    let newUsersWithNewLicense = 0;
    let existingUsersWithNewLicense = 0;

    newLicensesLast7Days.forEach(l => {
        if (allUsersBefore7Days.has(l.discordId)) {
            existingUsersWithNewLicense++;
        } else {
            const firstLicenseForThisUserInWindow = !newLicensesLast7Days.some(
                prevLic => prevLic.discordId === l.discordId && new Date(prevLic.createdAt) < new Date(l.createdAt)
            );
            if (firstLicenseForThisUserInWindow) {
                newUsersWithNewLicense++;
            } else {
                existingUsersWithNewLicense++;
            }
        }
    });
    
    const newLicenseDistribution: NewLicenseDistributionData[] = [
        { name: 'New Customers', value: newUsersWithNewLicense, fill: 'hsl(var(--chart-1))' },
        { name: 'Existing Customers', value: existingUsersWithNewLicense, fill: 'hsl(var(--chart-2))' },
    ];
    
    const dailyWebhookCreations: DailyWebhookCreationsData[] = eachDayOfInterval(interval).map(day => ({
      date: format(day, "MMM d"),
      creations: 0,
    }));

    licenses
        .filter(l => l.source?.startsWith('builtbybit') && new Date(l.createdAt) >= interval.start)
        .forEach(l => {
            const creationDate = new Date(l.createdAt);
            const formattedDate = format(startOfDay(creationDate), "MMM d");
            const dayData = dailyWebhookCreations.find(d => d.date === formattedDate);
            if (dayData) {
                dayData.creations++;
            }
        });


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
    };
}


const discordUserCache = new Map<string, any>();

export async function fetchDiscordUser(userId: string): Promise<any | null> {
    noStore();
    if (!userId || userId === 'N/A' || userId === 'unlinked') return null;
    
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) {
        return null;
    }


    if (discordUserCache.has(userId)) {
        return discordUserCache.get(userId);
    }
    
    try {
        const response = await fetch(`https://discord.com/api/users/${userId}`, {
            headers: {
                Authorization: `Bot ${token}`,
            },
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            if (response.status === 401) {
                 return null;
            }
            if (response.status === 404) {
                 discordUserCache.set(userId, null);
                 return null;
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

        discordUserCache.set(userId, user);
        return user;
    } catch (error) {
        discordUserCache.set(userId, null);
        return null;
    }
}

export async function getAllUsers(): Promise<Customer[]> {
    noStore();
    const licenses = await getLicenses();
    const allUserIds = new Set<string>();

    licenses.forEach(l => {
        if (l.discordId && l.discordId !== 'unlinked') {
            allUserIds.add(l.discordId);
        }
        l.subUserDiscordIds?.forEach(id => {
            if (id) allUserIds.add(id);
        });
    });

    const uniqueUserIds = Array.from(allUserIds);
    const discordUsers = await Promise.all(uniqueUserIds.map(id => fetchDiscordUser(id)));
    const discordUserMap = new Map(discordUsers.filter(Boolean).map(u => [u.id, u]));

    const customers: Customer[] = uniqueUserIds.map(userId => {
        const ownedLicenses = licenses.filter(l => l.discordId === userId);
        const subUserOnLicenses = licenses.filter(l => l.subUserDiscordIds?.includes(userId));
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
            builtByBitId: builtByBitId,
        };
    });

    return customers.sort((a, b) => {
        if (a.isOwner !== b.isOwner) {
            return a.isOwner ? -1 : 1;
        }
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

    botLogs.forEach(log => {
        const logDate = startOfDay(new Date(log.timestamp));
        const dayData = dailyUsage.find(d => d.date === format(logDate, "MMM d"));
        if (dayData) {
            dayData.commands++;
        }
    });

    return dailyUsage;
}
