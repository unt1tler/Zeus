
import { NextResponse, NextRequest } from 'next/server';
import { getSettings, getProducts, saveProducts, getLicenses, saveLicenses } from '@/lib/data';
import { timingSafeCompare } from '@/lib/auth';
import type { License, Product } from '@/lib/types';
import { sendWebhook } from '@/lib/logging';

export async function POST(request: NextRequest) {
  const settings = await getSettings();
  const { enabled, secret, disableIpProtection, maxIps, enableHwidProtection, maxHwids } = settings.builtByBitPlaceholder;

  if (!enabled) {
    return NextResponse.json({ error: "This feature is currently disabled by the panel administrator." }, { status: 503 });
  }

  try {
    const body = await request.json();

    if (!secret) {
      return NextResponse.json({ error: "Placeholder secret is not configured in the panel." }, { status: 500 });
    }

    if (!body.secret || !timingSafeCompare(body.secret, secret)) {
      return NextResponse.json({ error: "Invalid secret." }, { status: 401 });
    }

    const { product_id, customer_id, purchase_date } = body;

    if (!product_id || !customer_id) {
      return NextResponse.json({ error: "Missing product_id or customer_id." }, { status: 400 });
    }

    const [licenses, products] = await Promise.all([getLicenses(), getProducts()]);

    let product = products.find(p => p.id === product_id || p.builtByBitResourceId === product_id);

    // dedup - use resolved product ID for licenses created under admin-mapped products
    const resolvedProductId = product?.id || product_id;
    const normalizedDate = purchase_date ? String(purchase_date).trim() : '';
    const existingLicense = licenses.find(l =>
      l.platform === 'builtbybit' &&
      l.platformUserId === customer_id &&
      l.productId === resolvedProductId &&
      (l.purchaseTimestamp === purchase_date ||
       (normalizedDate && l.purchaseTimestamp && String(l.purchaseTimestamp).trim() === normalizedDate))
    );

    if (existingLicense) {
      return NextResponse.json({ license_key: existingLicense.key });
    }
    if (!product) {
      const newProduct: Product = {
        id: product_id,
        name: `BuiltByBit Product ${product_id}`,
        price: 0,
        imageUrl: `https://picsum.photos/seed/${crypto.randomUUID()}/400/300`,
        createdAt: new Date().toISOString(),
        hwidProtection: enableHwidProtection,
        builtByBitResourceId: product_id
      };
      products.unshift(newProduct);
      await saveProducts(products);
      product = newProduct;
    }

    const existingLinkedUser = licenses.find(l => l.platform === 'builtbybit' && l.platformUserId === customer_id && l.discordId !== 'unlinked');

    const newLicense: License = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId: product.id,
      platform: 'builtbybit',
      platformUserId: customer_id,
      discordId: existingLinkedUser?.discordId || 'unlinked',
      discordUsername: existingLinkedUser?.discordUsername,
      subUserDiscordIds: [],
      expiresAt: null,
      status: 'active',
      allowedIps: [],
      maxIps: disableIpProtection ? -2 : maxIps,
      allowedHwids: [],
      maxHwids: enableHwidProtection ? maxHwids : -2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validations: 0,
      purchaseTimestamp: purchase_date,
      source: 'builtbybit-placeholder',
    };

    licenses.unshift(newLicense);
    await saveLicenses(licenses);

    if (settings.logging.enabled && settings.logging.logBuiltByBit) {
      sendWebhook({
        title: 'New Purchase via BuiltByBit Placeholder',
        description: 'A new license has been created from a BuiltByBit placeholder download.',
        color: 0x0ea5e9,
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Product', value: product.name, inline: true },
          { name: 'BuiltByBit User ID', value: customer_id, inline: true },
          { name: 'Discord User', value: newLicense.discordId === 'unlinked' ? 'Not Linked' : `<@${newLicense.discordId}>`, inline: true },
          { name: 'License Key', value: `\`${newLicense.key}\``, inline: false },
        ]
      });
    }

    return NextResponse.json({ license_key: newLicense.key });

  } catch (error) {
    console.error("BuiltByBit Placeholder Webhook Error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
