
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProducts, saveProducts, getLicenses, saveLicenses, getSettings, saveSettings, addLog, getBlacklist, saveBlacklist, getVouchers, saveVouchers, fetchDiscordUser } from "./data";
import type { License, Product, Settings, Voucher, AdminApiEndpoints, DiscordBotSettings, BotStatus, ValidationResponseSettings } from "./types";
import { exec, spawn } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import { unstable_noStore as noStore } from 'next/cache';
import { sendWebhook } from "./logging";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const execAsync = util.promisify(exec);
const botPidPath = path.join(process.cwd(), 'src', 'bot', 'bot.pid');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function login(values: z.infer<typeof loginSchema>) {
  const validatedFields = loginSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Invalid fields." };
  }

  const { email, password } = validatedFields.data;

  if (email === process.env.LOGIN_EMAIL && password === process.env.LOGIN_PASSWORD) {
    cookies().set("session", process.env.SESSION_SECRET!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    redirect('/');
  }

  return { error: "Invalid email or password." };
}

export async function logout() {
  cookies().delete('session');
  redirect('/admin/login');
}

const productSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  imageData: z.string().optional(),
  hwidProtection: z.boolean().default(false),
  builtByBitResourceId: z.string().optional(),
});

export async function createProduct(values: z.infer<typeof productSchema>) {
  const validatedFields = productSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  const products = await getProducts();
  const newProduct: Product = {
    id: crypto.randomUUID(),
    name: validatedFields.data.name,
    price: validatedFields.data.price,
    imageUrl: validatedFields.data.imageData || `https://picsum.photos/seed/${crypto.randomUUID()}/400/300`,
    createdAt: new Date().toISOString(),
    hwidProtection: validatedFields.data.hwidProtection,
    builtByBitResourceId: validatedFields.data.builtByBitResourceId,
  };

  products.unshift(newProduct);
  await saveProducts(products);
  
  const settings = await getSettings();
  if (settings.logging.enabled && settings.logging.logLicenseCreations) {
    await sendWebhook({
        title: 'Product Created',
        description: `A new product has been created: **${newProduct.name}**`,
        color: 0x22c55e,
        timestamp: new Date().toISOString(),
        fields: [
            { name: 'Product ID', value: `\`${newProduct.id}\``, inline: false },
            { name: 'Price', value: `$${newProduct.price.toFixed(2)}`, inline: true },
            { name: 'HWID Protection', value: newProduct.hwidProtection ? 'Enabled' : 'Disabled', inline: true },
        ]
    });
  }


  revalidatePath("/products");
  revalidatePath("/");
  return { success: true };
}

export async function updateProduct(productId: string, values: z.infer<typeof productSchema>) {
  const validatedFields = productSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  const products = await getProducts();
  const productIndex = products.findIndex(p => p.id === productId);

  if (productIndex === -1) {
    return { success: false, message: "Product not found." };
  }

  const product = products[productIndex];
  product.name = validatedFields.data.name;
  product.price = validatedFields.data.price;
  product.hwidProtection = validatedFields.data.hwidProtection;
  product.builtByBitResourceId = validatedFields.data.builtByBitResourceId;
  if (validatedFields.data.imageData) {
    product.imageUrl = validatedFields.data.imageData;
  }
  
  products[productIndex] = product;
  await saveProducts(products);
  
  const settings = await getSettings();
  if (settings.logging.enabled && settings.logging.logLicenseUpdates) {
    await sendWebhook({
      title: 'Product Updated',
      description: `Product **${product.name}** has been updated.`,
      color: 0x3b82f6,
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Product ID', value: `\`${product.id}\``, inline: false },
        { name: 'New Price', value: `$${product.price.toFixed(2)}`, inline: true },
        { name: 'HWID Protection', value: product.hwidProtection ? 'Enabled' : 'Disabled', inline: true },
      ]
    });
  }

  revalidatePath("/products");
  revalidatePath("/");
  return { success: true };
}


export async function deleteProduct(productId: string) {
    let products = await getProducts();
    let licenses = await getLicenses();
    
    const productToDelete = products.find(p => p.id === productId);
    
    products = products.filter(p => p.id !== productId);
    licenses = licenses.filter(l => l.productId !== productId);

    await saveProducts(products);
    await saveLicenses(licenses);

    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseUpdates && productToDelete) {
        await sendWebhook({
            title: 'Product Deleted',
            description: `Product **${productToDelete.name}** and all of its associated licenses have been deleted.`,
            color: 0xef4444,
            timestamp: new Date().toISOString(),
        });
    }

    revalidatePath("/products");
    revalidatePath("/licenses");
    revalidatePath("/");
    return { success: true };
}

export async function createLicense(values: any) {
    const licenses = await getLicenses();
    const user = await fetchDiscordUser(values.discordId);
    
    const newLicense: License = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId: values.productId,
      platform: values.platform,
      platformUserId: values.platformUserId,
      discordId: values.discordId,
      discordUsername: user?.username || values.discordUsername,
      email: values.email,
      subUserDiscordIds: values.subUserDiscordIds || [],
      expiresAt: values.expiresAt,
      maxIps: values.maxIps,
      maxHwids: values.maxHwids,
      status: 'active',
      allowedIps: [],
      allowedHwids: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validations: 0,
      source: values.source || 'zeus',
    };

    licenses.unshift(newLicense);
    await saveLicenses(licenses);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseCreations) {
        const products = await getProducts();
        const product = products.find(p => p.id === newLicense.productId);
        await sendWebhook({
            title: 'License Created',
            description: `A new license was created for **${product?.name || 'Unknown Product'}**.`,
            color: 0x22c55e,
            timestamp: new Date().toISOString(),
            fields: [
                { name: 'Key', value: `\`${newLicense.key}\``, inline: false },
                { name: 'Owner', value: `${newLicense.discordUsername || newLicense.discordId} (\`${newLicense.discordId}\`)`, inline: true },
                { name: 'Source', value: newLicense.source || 'Manual', inline: true },
                { name: 'Expires', value: newLicense.expiresAt ? new Date(newLicense.expiresAt).toLocaleDateString() : 'Never', inline: true},
            ]
        });
    }


    revalidatePath('/licenses');
    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath('/records');
    if (values.discordId) {
        revalidatePath(`/customers/${values.discordId}`);
    }
    return { success: true, license: newLicense };
}

export async function updateLicense(key: string, formData: FormData) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);

    if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }
    
    const data = Object.fromEntries(formData);
    const license = licenses[licenseIndex];
    
    license.platform = data.platform as string;
    license.platformUserId = data.platformUserId as string || undefined;
    license.expiresAt = data.expiresAt ? new Date(data.expiresAt as string).toISOString() : null;
    license.maxIps = Number(data.maxIps);
    license.maxHwids = Number(data.maxHwids);
    license.updatedAt = new Date().toISOString();

    
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseUpdates) {
        await sendWebhook({
            title: 'License Updated',
            description: `License \`${license.key}\` has been updated.`,
            color: 0x3b82f6,
            timestamp: new Date().toISOString(),
            fields: [
                { name: 'New Expiration', value: license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never', inline: true },
                { name: 'New Max IPs', value: String(license.maxIps), inline: true },
                { name: 'New Max HWIDs', value: String(license.maxHwids), inline: true },
            ]
        });
    }


    revalidatePath('/licenses');
    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath('/records');
    revalidatePath(`/customers/${license.discordId}`);
    revalidatePath(`/client`);

    return { success: true, license: license };
}

export async function updateClientLicense(key: string, newAllowedIps: string[], newAllowedHwids: string[]) {
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie?.value) {
        return { success: false, message: 'Authentication required.' };
    }

    let user;
    try {
        user = JSON.parse(userCookie.value);
    } catch {
        return { success: false, message: 'Invalid session.' };
    }

    if (!user || !user.id) {
        return { success: false, message: 'Invalid user session.' };
    }

    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);

    if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }

    const license = licenses[licenseIndex];
    
    // **CRITICAL SECURITY CHECK**
    const isOwner = license.discordId === user.id;
    const isSubUser = (license.subUserDiscordIds || []).includes(user.id);
    
    if (!isOwner && !isSubUser) {
        return { success: false, message: 'You are not authorized to modify this license.' };
    }

    license.allowedIps = newAllowedIps;
    license.allowedHwids = newAllowedHwids;
    license.updatedAt = new Date().toISOString();
    
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);

    revalidatePath('/client');
    return { success: true };
}



export async function updateSettings(values: any) {
  try {
    const currentSettings = await getSettings();
    
    const mergeDeep = (target: any, source: any): any => {
      const output = { ...target };
      if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
        Object.keys(source).forEach(key => {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            if (!(key in target)) {
              Object.assign(output, { [key]: source[key] });
            } else {
              output[key] = mergeDeep(target[key], source[key]);
            }
          } else {
            Object.assign(output, { [key]: source[key] });
          }
        });
      }
      return output;
    }

    const newSettings = mergeDeep(currentSettings, values);

    await saveSettings(newSettings);

    const botConfigPath = path.join(process.cwd(), "src", "bot", "config.json");
    if (newSettings.discordBot) {
        await fs.writeFile(botConfigPath, JSON.stringify(newSettings.discordBot, null, 2));
    }

    revalidatePath("/settings", "layout");
    revalidatePath("/integration", 'layout');

    return { success: true };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return { success: false, message: "An internal server error occurred while saving settings." };
  }
}

export async function updateCustomerEmail(discordId: string, email: string) {
    const emailSchema = z.string().email("Invalid email address.").optional().or(z.literal(''));
    const validation = emailSchema.safeParse(email);

    if (!validation.success) {
        return { success: false, message: "Invalid email format." };
    }

    const licenses = await getLicenses();
    let licensesUpdated = false;

    licenses.forEach(license => {
        if (license.discordId === discordId) {
            if (license.email !== email) {
                license.email = email;
                license.updatedAt = new Date().toISOString();
                licensesUpdated = true;
            }
        }
    });

    if (licensesUpdated) {
        await saveLicenses(licenses);
    }
    
    revalidatePath(`/customers/${discordId}`);
    return { success: true };
}


export async function generateNewApiKey() {
    const settings = await getSettings();
    settings.apiKey = `LF-ADMIN-${crypto.randomUUID()}`;
    await saveSettings(settings);
    revalidatePath('/settings');
    return { success: true, newKey: settings.apiKey };
}

export async function deleteLicense(key: string) {
  let licenses = await getLicenses();
  const licenseToDelete = licenses.find(l => l.key === key);
  licenses = licenses.filter(l => l.key !== key);
  await saveLicenses(licenses);
  
  const settings = await getSettings();
  if (settings.logging.enabled && settings.logging.logLicenseUpdates && licenseToDelete) {
    const products = await getProducts();
    const product = products.find(p => p.id === licenseToDelete.productId);
    await sendWebhook({
        title: 'License Deleted',
        description: `License \`${licenseToDelete.key}\` for product **${product?.name || 'Unknown'}** has been permanently deleted.`,
        color: 0xef4444,
        timestamp: new Date().toISOString(),
    });
  }


  revalidatePath('/licenses');
  revalidatePath('/');
  revalidatePath('/customers');
  revalidatePath('/records');
  if (licenseToDelete) {
      revalidatePath(`/customers/${licenseToDelete.discordId}`);
  }
  return { success: true };
}

export async function updateLicenseStatus(key: string, status: 'active' | 'inactive' | 'expired') {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);

    if (licenseIndex === -1) {
        return { success: false, message: "License not found." };
    }

    licenses[licenseIndex].status = status;
    licenses[licenseIndex].updatedAt = new Date().toISOString();
    await saveLicenses(licenses);

    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseUpdates) {
        await sendWebhook({
            title: 'License Status Updated',
            description: `License \`${key}\` status set to **${status}**.`,
            color: status === 'active' ? 0x22c55e : 0xfb923c,
            timestamp: new Date().toISOString(),
        });
    }

    revalidatePath('/licenses');
    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath('/records');
    revalidatePath(`/customers/${licenses[licenseIndex].discordId}`);
    return { success: true, license: licenses[licenseIndex] };
}

const mockLocations: { city: string; country: string; countryCode: string; ip: string; }[] = [
    { city: "New York", country: "United States", countryCode: "US", ip: "98.12.34.56" },
    { city: "London", country: "United Kingdom", countryCode: "GB", ip: "82.34.56.78" },
    { city: "Tokyo", country: "Japan", countryCode: "JP", ip: "106.56.78.90" },
    { city: "Sydney", country: "Australia", countryCode: "AU", ip: "203.78.90.12" },
    { city: "Berlin", country: "Germany", countryCode: "DE", ip: "91.90.12.34" },
    { city: "São Paulo", country: "Brazil", countryCode: "BR", ip: "177.12.34.56" },
    { city: "Mumbai", country: "India", countryCode: "IN", ip: "115.34.56.78" },
];


export async function simulateValidationRequest(status: 'success' | 'failure') {
  const licenses = await getLicenses();
  const products = await getProducts();
  const randomLocation = mockLocations[Math.floor(Math.random() * mockLocations.length)];
  
  let logData: any;

  if (status === 'success' && licenses.length > 0 && products.length > 0) {
    const license = licenses[Math.floor(Math.random() * licenses.length)];
    const product = products.find(p => p.id === license.productId);
    logData = {
      licenseKey: license.key,
      productName: product?.name || "N/A",
      discordId: license.discordId,
      status: 'success',
    };
  } else {
    logData = {
      licenseKey: `LF-FAKE-${crypto.randomUUID().substring(0, 8)}`,
      productName: "N/A",
      discordId: "N/A",
      status: 'failure',
      reason: status === 'failure' ? 'Invalid key' : 'No products/licenses exist',
    };
  }

  await addLog({
    ...logData,
    timestamp: new Date().toISOString(),
    ipAddress: randomLocation.ip,
    hwid: null,
    location: {
      city: randomLocation.city,
      country: randomLocation.country,
      countryCode: randomLocation.countryCode,
    }
  });

  revalidatePath('/records');
  revalidatePath('/');
}

const blacklistSchema = z.object({
  type: z.enum(['ip', 'hwid', 'discordId']),
  value: z.string().min(1, "Value cannot be empty."),
});

export async function addToBlacklist(formData: FormData) {
  const validatedFields = blacklistSchema.safeParse({
    type: formData.get('type'),
    value: formData.get('value'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  const { type, value } = validatedFields.data;

  const blacklist = await getBlacklist();

  if (type === 'ip' && !blacklist.ips.includes(value)) {
    blacklist.ips.push(value);
  } else if (type === 'hwid' && !blacklist.hwids.includes(value)) {
    blacklist.hwids.push(value);
  } else if (type === 'discordId' && !blacklist.discordIds.includes(value)) {
    blacklist.discordIds.push(value);
  } else {
    return { success: false, message: 'Item is already in the blacklist.'}
  }

  await saveBlacklist(blacklist);
  
  const settings = await getSettings();
  if (settings.logging.enabled && settings.logging.logBlacklistActions) {
    await sendWebhook({
      title: 'Item Added to Blacklist',
      description: `An item has been manually added to the blacklist.`,
      color: 0xfb923c,
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Type', value: type, inline: true },
        { name: 'Value', value: `\`${value}\``, inline: true }
      ]
    });
  }

  revalidatePath('/blacklist');
  revalidatePath('/records');
  revalidatePath('/customers');

  return { success: true };
}

export async function removeFromBlacklist(type: 'ip' | 'hwid' | 'discordId', value: string) {
  const blacklist = await getBlacklist();

  if (type === 'ip') {
    blacklist.ips = blacklist.ips.filter((ip) => ip !== value);
  } else if (type === 'hwid') {
    blacklist.hwids = blacklist.hwids.filter((hwid) => hwid !== value);
  } else if (type === 'discordId') {
     blacklist.discordIds = blacklist.discordIds.filter((id) => id !== value);
  }

  await saveBlacklist(blacklist);
  
  const settings = await getSettings();
  if (settings.logging.enabled && settings.logging.logBlacklistActions) {
    await sendWebhook({
      title: 'Item Removed from Blacklist',
      description: `An item has been manually removed from the blacklist.`,
      color: 0x3b82f6,
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Type', value: type, inline: true },
        { name: 'Value', value: `\`${value}\``, inline: true }
      ]
    });
  }


  revalidatePath('/blacklist');
  revalidatePath('/records');
  revalidatePath('/customers');
  revalidatePath(`/customers/${value}`);
  
  return { success: true };
}

export async function addSubUserToLicense(key: string, discordId: string) {
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
    if (!license.subUserDiscordIds.includes(discordId)) {
        license.subUserDiscordIds.push(discordId);
    } else {
        return { success: false, message: 'User is already a sub-user on this license.' };
    }
    
    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);
    
    revalidatePath('/licenses');
    revalidatePath('/customers');
    revalidatePath(`/customers/${discordId}`);
    revalidatePath(`/customers/${license.discordId}`);
    return { success: true };
}

export async function removeSubUserFromLicense(key: string, discordId: string) {
    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);
     if (licenseIndex === -1) {
        return { success: false, message: 'License not found.' };
    }
    const license = licenses[licenseIndex];
    
    if (!license.subUserDiscordIds) {
        return { success: false, message: 'Sub-user not found on this license.' };
    }

    license.subUserDiscordIds = license.subUserDiscordIds.filter(id => id !== discordId);
    
    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);

    revalidatePath('/licenses');
    revalidatePath('/customers');
    revalidatePath(`/customers/${discordId}`);
    revalidatePath(`/customers/${license.discordId}`);
    return { success: true };
}


export async function blacklistUser(discordId: string) {
    const licenses = await getLicenses();
    const blacklist = await getBlacklist();

    if (blacklist.discordIds.includes(discordId)) {
        return { success: false, message: "User is already blacklisted." };
    }

    const userLicenses = licenses.filter(l => l.discordId === discordId);

    const ipsToAdd = new Set(blacklist.ips);
    const hwidsToAdd = new Set(blacklist.hwids);

    userLicenses.forEach(license => {
        license.allowedIps.forEach(ip => ipsToAdd.add(ip));
        license.allowedHwids.forEach(hwid => hwidsToAdd.add(hwid));
        license.status = 'inactive';
    });

    blacklist.ips = Array.from(ipsToAdd);
    blacklist.hwids = Array.from(hwidsToAdd);
    blacklist.discordIds.push(discordId);

    await saveBlacklist(blacklist);
    await saveLicenses(licenses);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logBlacklistActions) {
        const user = await fetchDiscordUser(discordId);
        await sendWebhook({
          title: 'User Blacklisted',
          description: `All licenses owned by this user have been deactivated, and all associated IPs/HWIDs have been added to the blacklist.`,
          color: 0xef4444,
          timestamp: new Date().toISOString(),
          fields: [{ name: 'User', value: `${user?.username || 'Unknown'} (\`${discordId}\`)`, inline: false }]
        });
    }


    revalidatePath('/blacklist');
    revalidatePath('/customers');
    revalidatePath(`/customers/${discordId}`);
    revalidatePath('/records');
    revalidatePath('/licenses');

    return { success: true };
}

export async function unblacklistUser(discordId: string) {
    const licenses = await getLicenses();
    const blacklist = await getBlacklist();
    const allOtherBlacklistedUsersLicenses = await getLicenses({ filterOut: [discordId] });

    if (!blacklist.discordIds.includes(discordId)) {
        return { success: false, message: "User is not blacklisted." };
    }

    const userLicenses = licenses.filter(l => l.discordId === discordId);
    
    const ipsFromUser = new Set<string>();
    const hwidsFromUser = new Set<string>();

    userLicenses.forEach(license => {
        license.allowedIps.forEach(ip => ipsFromUser.add(ip));
        license.allowedHwids.forEach(hwid => hwidsFromUser.add(hwid));
    });
    
    const otherBlacklistedIps = new Set<string>();
    const otherBlacklistedHwids = new Set<string>();
    allOtherBlacklistedUsersLicenses.forEach(license => {
        if(blacklist.discordIds.includes(license.discordId)) {
            license.allowedIps.forEach(ip => otherBlacklistedIps.add(ip));
            license.allowedHwids.forEach(hwid => otherBlacklistedHwids.add(hwid));
        }
    });

    blacklist.ips = blacklist.ips.filter(ip => !ipsFromUser.has(ip) || otherBlacklistedIps.has(ip));
    blacklist.hwids = blacklist.hwids.filter(hwid => !hwidsFromUser.has(hwid) || otherBlacklistedHwids.has(hwid));
    blacklist.discordIds = blacklist.discordIds.filter(id => id !== discordId);

    await saveBlacklist(blacklist);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logBlacklistActions) {
        const user = await fetchDiscordUser(discordId);
        await sendWebhook({
          title: 'User Unblacklisted',
          description: `This user has been removed from the blacklist. Associated IPs/HWIDs that are not tied to other blacklisted users may have been removed. Their licenses remain inactive.`,
          color: 0x22c55e,
          timestamp: new Date().toISOString(),
          fields: [{ name: 'User', value: `${user?.username || 'Unknown'} (\`${discordId}\`)`, inline: false }]
        });
    }

    revalidatePath('/blacklist');
    revalidatePath('/customers');
    revalidatePath(`/customers/${discordId}`);
    revalidatePath('/records');
    revalidatePath('/licenses');

    return { success: true };
}

export async function blacklistLicenseIdentifiers(key: string) {
    const licenses = await getLicenses();
    const license = licenses.find(l => l.key === key);

    if (!license) {
        return { success: false, message: "License not found." };
    }

    const blacklist = await getBlacklist();
    const ipsToAdd = new Set(blacklist.ips);
    const hwidsToAdd = new Set(blacklist.hwids);

    license.allowedIps.forEach(ip => ipsToAdd.add(ip));
    license.allowedHwids.forEach(hwid => hwidsToAdd.add(hwid));
    
    blacklist.ips = Array.from(ipsToAdd);
    blacklist.hwids = Array.from(hwidsToAdd);

    await saveBlacklist(blacklist);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logBlacklistActions) {
        await sendWebhook({
          title: 'License Identifiers Blacklisted',
          description: `All IPs/HWIDs on license \`${license.key}\` have been added to the blacklist.`,
          color: 0xfb923c,
          timestamp: new Date().toISOString(),
        });
    }

    revalidatePath('/blacklist');
    revalidatePath('/records');
    
    return { success: true };
}


export async function renewLicense(formData: FormData) {
    const renewSchema = z.object({
      key: z.string().min(1, "License key is required."),
      expiresAt: z.date({ required_error: "New expiration date is required." }),
    });

    const validatedFields = renewSchema.safeParse({
        key: formData.get('key'),
        expiresAt: formData.get('expiresAt') ? new Date(formData.get('expiresAt') as string) : undefined,
    });
    
    if (!validatedFields.success) {
        console.error("Validation failed:", validatedFields.error.flatten().fieldErrors);
        return { errors: validatedFields.error.flatten().fieldErrors };
    }

    const { key, expiresAt } = validatedFields.data;

    const licenses = await getLicenses();
    const licenseIndex = licenses.findIndex(l => l.key === key);

    if (licenseIndex === -1) {
        return { errors: { key: ['License not found.'] } };
    }

    licenses[licenseIndex].expiresAt = expiresAt.toISOString();
    licenses[licenseIndex].status = 'active';
    licenses[licenseIndex].updatedAt = new Date().toISOString();

    await saveLicenses(licenses);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseUpdates) {
        await sendWebhook({
          title: 'License Renewed',
          description: `License \`${key}\` has been renewed until **${expiresAt.toLocaleDateString()}**.`,
          color: 0x3b82f6,
          timestamp: new Date().toISOString(),
        });
    }

    revalidatePath('/licenses');
    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath('/records');
    revalidatePath(`/customers/${licenses[licenseIndex].discordId}`);

    return { success: true };
}

export async function createVoucher(productId: string, duration: string) {
    const products = await getProducts();
    if (!products.find(p => p.id === productId)) {
        return { success: false, message: "Product not found." };
    }

    const durationRegex = /^(\d+[my]|lifetime)$/;
    if (!durationRegex.test(duration)) {
        return { success: false, message: "Invalid duration format. Use '1m', '6m', '1y', or 'lifetime'." };
    }

    const vouchers = await getVouchers();
    const newVoucher: Voucher = {
        code: `V-${crypto.randomUUID().toUpperCase().substring(0, 8)}`,
        productId,
        duration,
        isRedeemed: false,
        createdAt: new Date().toISOString(),
    };

    vouchers.unshift(newVoucher);
    await saveVouchers(vouchers);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseCreations) {
        const product = products.find(p => p.id === productId);
        await sendWebhook({
          title: 'Voucher Created',
          description: `A new voucher has been created.`,
          color: 0xa855f7,
          timestamp: new Date().toISOString(),
          fields: [
            { name: 'Code', value: `\`${newVoucher.code}\``, inline: false },
            { name: 'Product', value: product?.name || 'Unknown', inline: true },
            { name: 'Duration', value: duration, inline: true },
          ],
        });
    }

    revalidatePath('/licenses');
    return { success: true, voucher: newVoucher };
}

export async function getBotStatus(): Promise<BotStatus> {
  noStore();
  const settings = await getSettings();
  if (!settings.discordBot.enabled) {
    return { status: 'offline' };
  }

  try {
    const response = await fetch('http://localhost:8081/status', {
        cache: 'no-store'
    });
    
    if (!response.ok) {
        return { status: 'offline' };
    }
    
    const data: BotStatus = await response.json();
    return data;
  
  } catch (error) {
    return { status: 'offline' };
  }
}

export async function revokeVoucher(code: string) {
    const vouchers = await getVouchers();
    
    const voucherToRevoke = vouchers.find(v => v.code === code);

    if (!voucherToRevoke) {
        return { success: false, message: "Voucher not found." };
    }
    if (voucherToRevoke.isRedeemed) {
        return { success: false, message: "Cannot revoke a voucher that has already been redeemed." };
    }
    
    const updatedVouchers = vouchers.filter(v => v.code !== code);

    await saveVouchers(updatedVouchers);
    
    const settings = await getSettings();
    if (settings.logging.enabled && settings.logging.logLicenseUpdates) {
        const products = await getProducts();
        const product = products.find(p => p.id === voucherToRevoke.productId);
        await sendWebhook({
          title: 'Voucher Revoked',
          description: `Voucher \`${code}\` for **${product?.name || 'Unknown'}** has been revoked.`,
          color: 0xef4444,
          timestamp: new Date().toISOString(),
        });
    }

    revalidatePath('/licenses');
    return { success: true };
}
