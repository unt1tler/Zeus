
import { NextResponse, NextRequest } from "next/server";
import { getLicenses, saveLicenses, addLog, getProducts, getBlacklist, getSettings, fetchDiscordUser } from "@/lib/data";
import type { License, Product } from "@/lib/types";

async function getLocation(ip: string) {
    if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return null;
    }
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return {
            city: data.city,
            country: data.country_name,
            countryCode: data.country_code,
            coordinates: [data.longitude, data.latitude],
        };
    } catch (error) {
        console.error("Could not fetch location for IP:", ip, error);
        return null;
    }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, hwid, discordId: requestDiscordId } = body;
    const ip = (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    const location = await getLocation(ip);
    const blacklist = await getBlacklist();
    const settings = await getSettings();

    const baseLogDetails = {
        licenseKey: key || 'N/A',
        ipAddress: ip,
        hwid: hwid || null,
        productName: 'N/A',
        discordId: requestDiscordId || 'N/A',
        location,
    };

    if (blacklist.ips.includes(ip)) {
        await addLog({ ...baseLogDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'Blacklisted IP' });
        return NextResponse.json({ success: false, status: "failure", message: "Access denied." }, { status: 403 });
    }

    if (hwid && blacklist.hwids.includes(hwid)) {
        await addLog({ ...baseLogDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'Blacklisted HWID' });
        return NextResponse.json({ success: false, status: "failure", message: "Access denied." }, { status: 403 });
    }
    
    if (requestDiscordId && blacklist.discordIds.includes(requestDiscordId)) {
        await addLog({ ...baseLogDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'User blacklisted' });
        return NextResponse.json({ success: false, status: "failure", message: "User is blacklisted." }, { status: 403 });
    }

    if (!key) {
      return NextResponse.json({ success: false, status: "failure", message: "Missing key." }, { status: 400 });
    }
    
    if (settings.validationResponse.requireDiscordId && !requestDiscordId) {
      return NextResponse.json({ success: false, status: "failure", message: "Missing discordId." }, { status: 400 });
    }


    const licenses = await getLicenses();
    const products = await getProducts();
    const licenseIndex = licenses.findIndex((l) => l.key === key);

    if (licenseIndex === -1) {
      await addLog({
        ...baseLogDetails,
        timestamp: new Date().toISOString(),
        status: 'failure',
        reason: 'Invalid key',
      });
      return NextResponse.json({ success: false, status: "failure", message: "Invalid license key." }, { status: 403 });
    }

    let license = licenses[licenseIndex];
    const product = products.find(p => p.id === license.productId);

    if (!product) {
        await addLog({ ...baseLogDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'Product not found' });
        return NextResponse.json({ success: false, status: "failure", message: "Associated product not found." }, { status: 404 });
    }
    
    if (!license.discordUsername && license.discordId) {
        const user = await fetchDiscordUser(license.discordId);
        if(user) {
            license.discordUsername = user.username;
        }
    }


    const logDetails = {
        licenseKey: key,
        ipAddress: ip,
        hwid: hwid || null,
        productName: product.name || 'N/A',
        discordId: requestDiscordId || license.discordId,
        location,
    };

    if (product.hwidProtection && !hwid) {
        await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'HWID required but not provided' });
        return NextResponse.json({ success: false, status: "failure", message: "This product requires a hardware ID for validation." }, { status: 403 });
    }

    if (blacklist.discordIds.includes(license.discordId)) {
         await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'License owner blacklisted' });
        return NextResponse.json({ success: false, status: "failure", message: "License owner is blacklisted." }, { status: 403 });
    }
    
    if (requestDiscordId) {
        const isAuthorizedUser = license.discordId === requestDiscordId || (license.subUserDiscordIds || []).includes(requestDiscordId);
        if (!isAuthorizedUser) {
            await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'User not authorized for this license' });
            return NextResponse.json({ success: false, status: "failure", message: "User is not authorized for this license." }, { status: 403 });
        }
    }


    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      license.status = 'expired';
      licenses[licenseIndex] = license;
      await saveLicenses(licenses);
      await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'License expired' });
      return NextResponse.json({ success: false, status: "failure", message: "License has expired." }, { status: 403 });
    }

    if (license.status !== 'active') {
      await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: `License inactive (status: ${license.status})` });
      return NextResponse.json({ success: false, status: "failure", message: `License is not active. Current status: ${license.status}.` }, { status: 403 });
    }

    if (license.maxIps !== -2) {
        if (!license.allowedIps.includes(ip)) {
            if (license.maxIps !== -1 && license.allowedIps.length >= license.maxIps) {
                await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'Max IPs reached' });
                return NextResponse.json({ success: false, status: "failure", message: "Maximum number of IPs reached for this license." }, { status: 403 });
            }
            license.allowedIps.push(ip);
        }
    }
    
    if (product.hwidProtection && hwid) {
        if (license.maxHwids !== -1) { 
            if (!license.allowedHwids.includes(hwid)) {
                if (license.allowedHwids.length >= license.maxHwids) {
                    await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'failure', reason: 'Max HWIDs reached' });
                    return NextResponse.json({ success: false, status: "failure", message: "Maximum number of HWIDs reached for this license." }, { status: 403 });
                }
                license.allowedHwids.push(hwid);
            }
        }
    }

    license.validations = (license.validations || 0) + 1;
    licenses[licenseIndex] = license;
    await saveLicenses(licenses);

    await addLog({ ...logDetails, timestamp: new Date().toISOString(), status: 'success' });
    
    const { validationResponse } = settings;
    let responsePayload: any = {
      success: true,
      status: "success",
    };

    if (validationResponse.customSuccessMessage.enabled) {
        responsePayload.message = validationResponse.customSuccessMessage.message || "License key is valid";
    }
    
    if (validationResponse.license.enabled) {
        const licenseInfo: { [key: string]: any } = {};
        if (validationResponse.license.fields.license_key) licenseInfo.license_key = license.key;
        if (validationResponse.license.fields.status) licenseInfo.status = license.status;
        if (validationResponse.license.fields.expires_at) licenseInfo.expires_at = license.expiresAt;
        if (validationResponse.license.fields.issue_date) licenseInfo.issue_date = license.createdAt;
        if (validationResponse.license.fields.max_ips) licenseInfo.max_ips = license.maxIps;
        if (validationResponse.license.fields.used_ips) licenseInfo.used_ips = license.allowedIps;
        if (Object.keys(licenseInfo).length > 0) responsePayload.license = licenseInfo;
    }
    
    if (validationResponse.customer.enabled) {
        const customerInfo: { [key: string]: any } = {};
        if (validationResponse.customer.fields.id) customerInfo.id = license.discordId; 
        if (validationResponse.customer.fields.discord_id) customerInfo.discord_id = license.discordId;
        if (validationResponse.customer.fields.customer_since) customerInfo.customer_since = license.createdAt; 
        if (Object.keys(customerInfo).length > 0) responsePayload.customer = customerInfo;
    }
    
    if (validationResponse.product.enabled && product) {
        const productInfo: { [key: string]: any } = {};
        if (validationResponse.product.fields.id) productInfo.id = product.id;
        if (validationResponse.product.fields.name) productInfo.name = product.name;
        if (validationResponse.product.fields.enabled) productInfo.enabled = true; 
        if (Object.keys(productInfo).length > 0) responsePayload.product = productInfo;
    }
    
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json({ status: "failure", message: "An internal server error occurred." }, { status: 500 });
  }
}
