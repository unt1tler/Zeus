import { NextRequest, NextResponse } from "next/server";
import {
  findPlatformAccountLink,
  getSettings,
  updateLicenses,
  updateProducts,
} from "@/lib/data";
import { timingSafeCompare } from "@/lib/auth";
import { matchesBuiltByBitPurchaseTimestamp, parseBuiltByBitPayload } from "@/lib/builtbybit";
import type { License, Product } from "@/lib/types";
import { sendWebhook } from "@/lib/logging";

function buildProduct({
  resourceId,
  resourceTitle,
  finalPrice,
  enableHwidProtection,
}: {
  resourceId: string;
  resourceTitle?: string;
  finalPrice?: string;
  enableHwidProtection: boolean;
}): Product {
  return {
    id: resourceId,
    name: resourceTitle || `BuiltByBit Product ${resourceId}`,
    price: Number.parseFloat(finalPrice ?? "") || 0,
    imageUrl: `https://picsum.photos/seed/${crypto.randomUUID()}/400/300`,
    createdAt: new Date().toISOString(),
    hwidProtection: enableHwidProtection,
    builtByBitResourceId: resourceId,
  };
}

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
    const body = await parseBuiltByBitPayload(request);

    if (!body.secret || !timingSafeCompare(body.secret, webhookConfig.secret)) {
      return NextResponse.json({ error: "Invalid secret." }, { status: 401 });
    }

    const platformUserId = body.user_id;
    const resourceId = body.resource_id;
    const resourceTitle = body.resource_title;
    const purchaseTimestamp = body.purchase_date;

    if (!platformUserId || !resourceId) {
      return NextResponse.json({ error: "Missing user_id or resource_id." }, { status: 400 });
    }

    const linkedAccount = await findPlatformAccountLink("builtbybit", platformUserId);

    let product: Product | undefined;
    await updateProducts(async (products) => {
      const existingProductIndex = products.findIndex(
        (candidate) => candidate.id === resourceId || candidate.builtByBitResourceId === resourceId
      );

      if (existingProductIndex !== -1) {
        const existingProduct = products[existingProductIndex];
        const shouldBackfillName =
          !!resourceTitle &&
          existingProduct.name.startsWith("BuiltByBit Product ") &&
          existingProduct.name !== resourceTitle;
        const parsedPrice = Number.parseFloat(body.final_price ?? "");
        const shouldBackfillPrice =
          Number.isFinite(parsedPrice) &&
          existingProduct.price === 0 &&
          parsedPrice > 0;

        if (shouldBackfillName || shouldBackfillPrice) {
          products[existingProductIndex] = {
            ...existingProduct,
            ...(shouldBackfillName ? { name: resourceTitle } : {}),
            ...(shouldBackfillPrice ? { price: parsedPrice } : {}),
          };
        }

        product = products[existingProductIndex];
        return products;
      }

      product = buildProduct({
        resourceId,
        resourceTitle,
        finalPrice: body.final_price,
        enableHwidProtection: webhookConfig.enableHwidProtection || false,
      });
      products.unshift(product);
      return products;
    });

    if (!product) {
      return NextResponse.json({ error: "Unable to resolve product." }, { status: 500 });
    }

    const licenseResult: { created?: License; duplicate?: License } = {};

    await updateLicenses(async (licenses) => {
      const duplicateIndex = licenses.findIndex(
        (license) =>
          license.platform === "builtbybit" &&
          license.platformUserId === platformUserId &&
          license.productId === product!.id &&
          matchesBuiltByBitPurchaseTimestamp(license.purchaseTimestamp, purchaseTimestamp)
      );

      if (duplicateIndex !== -1) {
        const duplicate = licenses[duplicateIndex];
        if (
          linkedAccount &&
          (duplicate.discordId !== linkedAccount.discordId ||
            (!!linkedAccount.discordUsername && duplicate.discordUsername !== linkedAccount.discordUsername))
        ) {
          licenses[duplicateIndex] = {
            ...duplicate,
            discordId: linkedAccount.discordId,
            discordUsername: linkedAccount.discordUsername || duplicate.discordUsername,
            updatedAt: new Date().toISOString(),
          };
          licenseResult.duplicate = licenses[duplicateIndex];
        } else {
          licenseResult.duplicate = duplicate;
        }
        return licenses;
      }

      const existingLinkedLicense = licenses.find(
        (license) =>
          license.platform === "builtbybit" &&
          license.platformUserId === platformUserId &&
          license.discordId !== "unlinked"
      );

      const createdLicense: License = {
        id: crypto.randomUUID(),
        key: `LF-${crypto.randomUUID().toUpperCase()}`,
        productId: product!.id,
        platform: "builtbybit",
        platformUserId,
        discordId: linkedAccount?.discordId || existingLinkedLicense?.discordId || "unlinked",
        discordUsername: linkedAccount?.discordUsername || existingLinkedLicense?.discordUsername,
        subUserDiscordIds: [],
        expiresAt: null,
        status: "active",
        allowedIps: [],
        maxIps: webhookConfig.disableIpProtection ? -2 : webhookConfig.maxIps || 1,
        allowedHwids: [],
        maxHwids: webhookConfig.enableHwidProtection ? webhookConfig.maxHwids || 1 : -2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validations: 0,
        purchaseTimestamp,
        source: "builtbybit-webhook",
      };

      licenseResult.created = createdLicense;
      licenses.unshift(createdLicense);
      return licenses;
    });

    const duplicateLicenseResult = licenseResult.duplicate;
    if (duplicateLicenseResult) {
      return NextResponse.json({
        success: true,
        license_key: duplicateLicenseResult.key,
        message: "Duplicate event. License already processed.",
      });
    }

    const createdLicenseResult = licenseResult.created;
    if (!createdLicenseResult) {
      return NextResponse.json({ error: "Failed to create license." }, { status: 500 });
    }

    if (settings.logging.enabled && settings.logging.logBuiltByBit) {
      sendWebhook({
        title: "New Purchase via BuiltByBit Webhook",
        description: "A new license has been created from a BuiltByBit purchase.",
        color: 0x0ea5e9,
        timestamp: new Date().toISOString(),
        fields: [
          { name: "Product", value: product.name, inline: true },
          { name: "BuiltByBit User ID", value: platformUserId, inline: true },
          {
            name: "Discord User",
            value: createdLicenseResult.discordId === "unlinked" ? "Not Linked" : `<@${createdLicenseResult.discordId}>`,
            inline: true,
          },
          { name: "License Key", value: `\`${createdLicenseResult.key}\``, inline: false },
        ],
      });
    }

    return NextResponse.json({ success: true, license_key: createdLicenseResult.key });
  } catch (error) {
    console.error("BuiltByBit Webhook Error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
