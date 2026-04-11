
import { NextResponse } from 'next/server';
import { getLicenses, saveLicenses, getProducts, fetchDiscordUser } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';
import type { License } from '@/lib/types';

export async function GET() {
  const auth = await checkAdminApiKey('getLicenses');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const [licenses, products] = await Promise.all([getLicenses(), getProducts()]);
  const productMap = new Map(products.map(p => [p.id, p]));

  const populatedLicenses = licenses.map(license => ({
    ...license,
    productName: productMap.get(license.productId)?.name || 'N/A',
  }));

  return NextResponse.json(populatedLicenses);
}

export async function POST(request: Request) {
  const auth = await checkAdminApiKey('createLicense');
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
      if (user) discordUsername = user.username;
    }

    const licenses = await getLicenses();
    const newLicense: License = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId,
      discordId,
      discordUsername,
      email: email || undefined,
      platform,
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
      source: 'zeus',
    };

    licenses.unshift(newLicense);
    await saveLicenses(licenses);

    return NextResponse.json(newLicense, { status: 201 });
  } catch {
    return NextResponse.json({ message: "An internal server error occurred." }, { status: 500 });
  }
}
