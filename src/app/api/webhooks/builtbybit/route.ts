
import { NextResponse, NextRequest } from 'next/server';
import { getSettings, getProducts, saveProducts, getLicenses, saveLicenses } from '@/lib/data';
import { timingSafeCompare } from '@/lib/auth';
import type { License, Product } from '@/lib/types';
import { sendWebhook } from '@/lib/logging';

export async function POST(request: NextRequest) {
  const settings = await getSettings();
  const webhookConfig = settings.builtByBitWebhookSecret;

  if (!webhookConfig?.enabled) {
    return NextResponse.json({ success: true, message: "Webhook ignored, feature disabled." });
  }

  if (!webhookConfig.secret) {
    return NextResponse.json({ success: true, message: "Webhook ignored, not configured." });
  }

  try {
    const body = await request.json();

    if (!body.secret || !timingSafeCompare(body.secret, webhookConfig.secret)) {
      return NextResponse.json({ error: "Invalid secret." }, { status: 401 });
    }

    const {
      user_id: platformUserId,
      resource_id: productId,
      resource_title: productTitle,
      purchase_date: purchaseTimestamp,
    } = body;

    if (!platformUserId || !productId) {
      return NextResponse.json({ error: "Missing user_id or resource_id" }, { status: 400 });
    }

    const [licenses, products] = await Promise.all([getLicenses(), getProducts()]);

    let product = products.find(p => p.id === productId || p.builtByBitResourceId === productId);

    // dedup check - use resolved product ID for licenses created under admin-mapped products
    const resolvedProductId = product?.id || productId;
    const normalizedTimestamp = purchaseTimestamp ? String(purchaseTimestamp).trim() : '';
    const isDuplicate = licenses.some(l =>
      l.platform === 'builtbybit' &&
      l.platformUserId === platformUserId &&
      l.productId === resolvedProductId &&
      (l.purchaseTimestamp === purchaseTimestamp ||
       (normalizedTimestamp && l.purchaseTimestamp && String(l.purchaseTimestamp).trim() === normalizedTimestamp))
    );

    if (isDuplicate) {
      return NextResponse.json({ success: true, message: "Duplicate event. License already processed." });
    }
    if (!product) {
      const newProduct: Product = {
        id: productId,
        name: productTitle || `BuiltByBit Product ${productId}`,
        price: parseFloat(body.final_price) || 0,
        imageUrl: `https://picsum.photos/seed/${crypto.randomUUID()}/400/300`,
        createdAt: new Date().toISOString(),
        hwidProtection: webhookConfig.enableHwidProtection || false,
        builtByBitResourceId: productId,
      };
      products.unshift(newProduct);
      await saveProducts(products);
      product = newProduct;
    }

    const existingLinkedUser = licenses.find(l => l.platform === 'builtbybit' && l.platformUserId === platformUserId && l.discordId !== 'unlinked');

    const newLicense: License = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId: product.id,
      platform: 'builtbybit',
      platformUserId,
      discordId: existingLinkedUser?.discordId || 'unlinked',
      discordUsername: existingLinkedUser?.discordUsername,
      subUserDiscordIds: [],
      expiresAt: null,
      status: 'active',
      allowedIps: [],
      maxIps: webhookConfig.disableIpProtection ? -2 : (webhookConfig.maxIps || 1),
      allowedHwids: [],
      maxHwids: webhookConfig.enableHwidProtection ? (webhookConfig.maxHwids || 1) : -2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validations: 0,
      purchaseTimestamp,
      source: 'builtbybit-webhook',
    };

    licenses.unshift(newLicense);
    await saveLicenses(licenses);

    if (settings.logging.enabled && settings.logging.logBuiltByBit) {
      sendWebhook({
        title: 'New Purchase via BuiltByBit Webhook',
        description: 'A new license has been created from a BuiltByBit purchase.',
        color: 0x0ea5e9,
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Product', value: product.name, inline: true },
          { name: 'BuiltByBit User ID', value: platformUserId, inline: true },
          { name: 'Discord User', value: newLicense.discordId === 'unlinked' ? 'Not Linked' : `<@${newLicense.discordId}>`, inline: true },
          { name: 'License Key', value: `\`${newLicense.key}\``, inline: false },
        ]
      });
    }

    return NextResponse.json({ success: true, license_key: newLicense.key });

  } catch (error) {
    console.error("BuiltByBit Webhook Error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
