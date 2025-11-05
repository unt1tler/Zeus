
const fs = require('fs/promises');
const path = require('path');
const { format, addMonths, addYears } = require('date-fns');

const dataDir = path.resolve(process.cwd(), "data");

async function ensureDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readFile(filename, defaultValue) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (data === "") return defaultValue;
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeFile(filename, defaultValue);
      return defaultValue;
    }
    console.error(`Error reading ${filename}:`, error);
    return defaultValue;
  }
}

async function writeFile(filename, data) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function getProducts() { return await readFile("products.json", []);}

async function getLicenses() { return await readFile("licenses.json", []);}
async function saveLicenses(licenses) { await writeFile("licenses.json", licenses);}
async function createLicense(data) {
    const licenses = await getLicenses();
    const newLicense = {
        id: require('crypto').randomUUID(),
        key: `LF-${require('crypto').randomUUID().toUpperCase()}`,
        productId: data.productId,
        discordId: data.discordId,
        expiresAt: data.expiresAt,
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
    await saveLicenses(licenses);
    return { success: true, license: newLicense };
}

async function updateLicenseStatus(key, status) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);
    if (licenseIndex === -1) {
        return { success: false, message: "License not found." };
    }
    licenses[licenseIndex].status = status;
    licenses[licenseIndex].updatedAt = new Date().toISOString();
    await saveLicenses(licenses);
    return { success: true };
}

async function addSubUserToLicense(key, discordId) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);
    if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }
    const license = licenses[licenseIndex];
    if (license.discordId === discordId) {
        return { success: false, message: 'User is the owner of this license.' };
    }
    if (!license.subUserDiscordIds) {
        license.subUserDiscordIds = [];
    }
    if (license.subUserDiscordIds.includes(discordId)) {
        return { success: false, message: 'User is already a sub-user on this license.' };
    }
    license.subUserDiscordIds.push(discordId);
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);
    return { success: true, license };
}

async function removeSubUserFromLicense(key, discordId) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);
    if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }
    const license = licenses[licenseIndex];
    if (!license.subUserDiscordIds || !license.subUserDiscordIds.includes(discordId)) {
        return { success: false, message: 'Sub-user not found on this license.' };
    }
    license.subUserDiscordIds = license.subUserDiscordIds.filter(id => id !== discordId);
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);
    return { success: true, license };
}


async function renewLicense(key, duration) {
    const licenses = await getLicenses();
    const products = await getProducts();
    const licenseIndex = licenses.findIndex(l => l.key === key);
    if (licenseIndex === -1) {
        return { success: false, message: "License not found." };
    }

    const license = licenses[licenseIndex];
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
        else return { success: false, message: "Invalid duration format."};
    }
    
    license.expiresAt = newExpiryDate ? newExpiryDate.toISOString() : null;
    license.status = 'active';
    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);

    return { success: true, license, productName: product?.name || 'N/A' };
}

async function resetLicenseIdentities(key, type) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);
    if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }

    if (type === 'ips') {
        licenses[licenseIndex].allowedIps = [];
    } else if (type === 'hwids') {
        licenses[licenseIndex].allowedHwids = [];
    } else {
        return { success: false, message: 'Invalid identity type.' };
    }

    licenses[licenseIndex].updatedAt = new Date().toISOString();
    await saveLicenses(licenses);
    return { success: true, license: licenses[licenseIndex] };
}

async function addLicenseIdentity(key, type, value) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);
    if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }

    const license = licenses[licenseIndex];
    if (type === 'ip') {
        if (license.maxIps !== -1 && license.allowedIps.length >= license.maxIps) {
            return { success: false, message: 'Maximum number of IPs reached.' };
        }
        if (!license.allowedIps.includes(value)) {
            license.allowedIps.push(value);
        } else {
             return { success: false, message: 'This IP is already on the license.' };
        }
    } else if (type === 'hwid') {
        if (license.maxHwids !== -1 && license.allowedHwids.length >= license.maxHwids) {
            return { success: false, message: 'Maximum number of HWIDs reached.' };
        }
        if (!license.allowedHwids.includes(value)) {
            license.allowedHwids.push(value);
        } else {
            return { success: false, message: 'This HWID is already on the license.' };
        }
    } else {
        return { success: false, message: 'Invalid identity type.' };
    }

    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);
    return { success: true, license };
}

async function updateLicensesByPlatformId(platform, platformUserId, discordId) {
    if (!platform || !platformUserId || !discordId) {
        return { success: false, message: 'Missing required parameters.'};
    }
    const licenses = await getLicenses();
    const products = await getProducts();
    let updatedCount = 0;

    const currentlyLinkedLicense = licenses.find(l => 
        l.platform === platform && 
        l.platformUserId === platformUserId &&
        l.discordId !== discordId
    );

    if (currentlyLinkedLicense) {
        const oldUserId = currentlyLinkedLicense.discordId;
        licenses.forEach(license => {
            if (license.discordId === oldUserId && license.platform === platform && license.platformUserId === platformUserId) {
                license.platformUserId = undefined;
                license.updatedAt = new Date().toISOString();
            }
        });
    }


    const userProducts = new Set();
    licenses.forEach(l => {
        if (l.platform === platform && l.platformUserId === platformUserId) {
            const product = products.find(p => p.id === l.productId);
            if (product?.builtByBitResourceId) {
                userProducts.add(product.builtByBitResourceId);
            }
        }
    });

    for (let i = 0; i < licenses.length; i++) {
        const product = products.find(p => p.id === licenses[i].productId);
        if (product?.builtByBitResourceId && userProducts.has(product.builtByBitResourceId) && licenses[i].discordId === discordId) {
             if (licenses[i].platformUserId !== platformUserId) {
                licenses[i].platform = platform;
                licenses[i].platformUserId = platformUserId;
                licenses[i].updatedAt = new Date().toISOString();
                updatedCount++;
            }
        }
    }

    if (updatedCount > 0 || currentlyLinkedLicense) {
        await saveLicenses(licenses);
    }
    return { success: true, updatedCount };
}


async function getVouchers() { return await readFile("vouchers.json", []);}
async function saveVouchers(vouchers) { await writeFile("vouchers.json", vouchers);}

async function getBlacklist() { return await readFile("blacklist.json", { ips: [], hwids: [], discordIds: [] });}

const discordUserCache = new Map();
async function fetchDiscordUser(userId) {
    if (!userId || userId === 'N/A') return null;

    let token = process.env.DISCORD_BOT_TOKEN;
     if (!token) {
        console.warn("Discord bot token is not configured in .env. Cannot fetch user.");
        return null;
    }

    if (discordUserCache.has(userId)) {
        return discordUserCache.get(userId);
    }
    
    try {
        const response = await fetch(`https://discord.com/api/users/${userId}`, {
            headers: { Authorization: `Bot ${token}` },
        });

        if (!response.ok) {
            console.error(`Discord API responded with ${response.status} for user ${userId}`);
            return null;
        }

        const userData = await response.json();
        const user = {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null
        };

        discordUserCache.set(userId, user);
        return user;
    } catch (error) {
        console.error("Error fetching Discord user:", error);
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
