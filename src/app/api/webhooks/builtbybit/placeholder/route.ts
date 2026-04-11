import { NextRequest, NextResponse } from "next/server";
import {
  findPlatformAccountLink,
  getSettings,
  updateLicenses,
  updateProducts,
} from "@/lib/data";
import { timingSafeCompare } from "@/lib/auth";
import { parseBuiltByBitPayload } from "@/lib/builtbybit";
import type { License, Product } from "@/lib/types";
import { sendWebhook } from "@/lib/logging";

function textResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function buildProduct(resourceId: string, enableHwidProtection: boolean): Product {
  return {
    id: resourceId,
    name: `BuiltByBit Product ${resourceId}`,
    price: 0,
    imageUrl: `https://picsum.photos/seed/${crypto.randomUUID()}/400/300`,
    createdAt: new Date().toISOString(),
    hwidProtection: enableHwidProtection,
    builtByBitResourceId: resourceId,
  };
}

export async function POST(request: NextRequest) {
  const settings = await getSettings();
  const { enabled, secret, disableIpProtection, maxIps, enableHwidProtection, maxHwids } = settings.builtByBitPlaceholder;

  if (!enabled) {
    return textResponse("BuiltByBit placeholder automation is disabled.", 503);
  }

  if (!secret) {
    return textResponse("BuiltByBit placeholder secret is not configured.", 500);
  }

  try {
    const body = await parseBuiltByBitPayload(request);

    if (!body.secret || !timingSafeCompare(body.secret, secret)) {
      return textResponse("Invalid secret.", 401);
    }

    const platformUserId = body.user_id;
    const resourceId = body.resource_id;

    if (!platformUserId || !resourceId) {
      return textResponse("Missing user_id or resource_id.", 400);
    }

    const linkedAccount = await findPlatformAccountLink("builtbybit", platformUserId);

    let product: Product | undefined;
    await updateProducts(async (products) => {
      const existingProduct = products.find(
        (candidate) => candidate.id === resourceId || candidate.builtByBitResourceId === resourceId
      );

      if (existingProduct) {
        product = existingProduct;
        return products;
      }

      product = buildProduct(resourceId, enableHwidProtection);
      products.unshift(product);
      return products;
    });

    if (!product) {
      return textResponse("Unable to resolve product.", 500);
    }

    const licenseResult: { created?: License; existing?: License } = {};

    await updateLicenses(async (licenses) => {
      const existingIndex = licenses.findIndex(
        (license) =>
          license.platform === "builtbybit" &&
          license.platformUserId === platformUserId &&
          license.productId === product!.id
      );

      if (existingIndex !== -1) {
        const duplicate = licenses[existingIndex];
        if (
          linkedAccount &&
          (duplicate.discordId !== linkedAccount.discordId ||
            (!!linkedAccount.discordUsername && duplicate.discordUsername !== linkedAccount.discordUsername))
        ) {
          licenses[existingIndex] = {
            ...duplicate,
            discordId: linkedAccount.discordId,
            discordUsername: linkedAccount.discordUsername || duplicate.discordUsername,
            updatedAt: new Date().toISOString(),
          };
          licenseResult.existing = licenses[existingIndex];
        } else {
          licenseResult.existing = duplicate;
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
        maxIps: disableIpProtection ? -2 : maxIps,
        allowedHwids: [],
        maxHwids: enableHwidProtection ? maxHwids : -2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validations: 0,
        source: "builtbybit-placeholder",
      };

      licenseResult.created = createdLicense;
      licenses.unshift(createdLicense);
      return licenses;
    });

    const createdLicenseResult = licenseResult.created;
    const licenseToReturn = licenseResult.existing ?? createdLicenseResult;
    if (!licenseToReturn) {
      return textResponse("Failed to create license.", 500);
    }

    if (createdLicenseResult && settings.logging.enabled && settings.logging.logBuiltByBit) {
      sendWebhook({
        title: "New Purchase via BuiltByBit Placeholder",
        description: "A new license has been created from a BuiltByBit placeholder download.",
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

    return textResponse(licenseToReturn.key);
  } catch (error) {
    console.error("BuiltByBit Placeholder Webhook Error:", error);
    return textResponse("An internal server error occurred.", 500);
  }
}
