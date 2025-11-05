
import { NextResponse } from 'next/server';
import { getLicenses, saveLicenses, getProducts, getSettings, fetchDiscordUser } from '@/lib/data';
import type { License } from '@/lib/types';
import { headers } from 'next/headers';

async function checkApiKey() {
    const settings = await getSettings();
    if (!settings.adminApiEnabled) {
        return { authorized: false, message: 'Admin API is disabled.' };
    }
    const headersList = headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey || apiKey !== settings.apiKey) {
        return { authorized: false, message: 'Invalid or missing API key.' };
    }
    return { authorized: true };
}

export async function GET(request: Request) {
  const auth = await checkApiKey();
  if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const licenses = await getLicenses();
  const products = await getProducts();

  const populatedLicenses = licenses.map(license => {
    const product = products.find(p => p.id === license.productId);
    return { ...license, productName: product?.name || 'N/A' };
  });

  return NextResponse.json(populatedLicenses);
}

export async function POST(request: Request) {
  const auth = await checkApiKey();
  if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  try {
    const body = await request.json();
    let { 
        productId, 
        discordId, 
        discordUsername, 
        email, 
        expiresAt, 
        maxIps = 1, 
        maxHwids = 1,
        platform = 'custom',
        platformUserId,
        subUserDiscordIds,
    } = body;

    if (!productId || !discordId) {
      return NextResponse.json({ message: "productId and discordId are required." }, { status: 400 });
    }

    const products = await getProducts();
    if (!products.some(p => p.id === productId)) {
        return NextResponse.json({ message: "Product not found." }, { status: 404 });
    }

    if (!discordUsername) {
        const user = await fetchDiscordUser(discordId);
        if (user) {
            discordUsername = user.username;
        }
    }

    const licenses = await getLicenses();
    const newLicense: License = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId,
      discordId,
      discordUsername: discordUsername,
      email: email || undefined,
      platform: platform,
      platformUserId: platformUserId || undefined,
      subUserDiscordIds: subUserDiscordIds || [],
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      status: 'active',
      allowedIps: [],
      maxIps: Number(maxIps),
      allowedHwids: [],
      maxHwids: Number(maxHwids),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validations: 0,
    };

    licenses.unshift(newLicense);
    await saveLicenses(licenses);

    return NextResponse.json(newLicense, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "An internal server error occurred." }, { status: 500 });
  }
}
