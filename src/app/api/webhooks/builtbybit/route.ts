
import { NextResponse, NextRequest } from 'next/server';
import { getSettings, getProducts, saveProducts, getLicenses, saveLicenses, fetchDiscordUser } from '@/lib/data';
import type { License, Product } from '@/lib/types';
import { sendWebhook } from '@/lib/logging';

export async function POST(request: NextRequest) {
    const settings = await getSettings();
    const webhookConfig = settings.builtByBitWebhookSecret;

    if (!webhookConfig?.enabled) {
        console.log("BuiltByBit purchase webhook received, but feature is disabled. Ignoring.");
        return NextResponse.json({ success: true, message: "Webhook ignored, feature disabled." });
    }
    
    if (!webhookConfig.secret) {
        console.log("BuiltByBit purchase webhook received, but secret is not configured. Ignoring.");
        return NextResponse.json({ success: true, message: "Webhook ignored, not configured." });
    }

    try {
        const body = await request.json();

        if (body.secret !== webhookConfig.secret) {
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
        
        const licenses = await getLicenses();
        const products = await getProducts();
        
        // --- Deduplication Check ---
        const existingLicenseByTimestamp = licenses.find(l => 
            l.platform === 'builtbybit' && 
            l.platformUserId === platformUserId &&
            l.productId === productId &&
            l.purchaseTimestamp === purchaseTimestamp
        );
        
        if (existingLicenseByTimestamp) {
            console.log(`[Purchase Webhook] Duplicate purchase event for user ${platformUserId}, product ${productId}. Ignoring.`);
            return NextResponse.json({ success: true, message: "Duplicate event. License already processed." });
        }

        let product = products.find(p => p.id === productId);
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
            platformUserId: platformUserId,
            discordId: existingLinkedUser?.discordId || 'unlinked',
            discordUsername: existingLinkedUser?.discordUsername,
            subUserDiscordIds: [],
            expiresAt: null, // Lifetime for all webhook-generated licenses
            status: 'active',
            allowedIps: [],
            maxIps: webhookConfig.disableIpProtection ? -2 : (webhookConfig.maxIps || 1),
            allowedHwids: [],
            maxHwids: webhookConfig.enableHwidProtection ? (webhookConfig.maxHwids || 1) : -1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            validations: 0,
            purchaseTimestamp: purchaseTimestamp,
            source: 'builtbybit-webhook',
        };

        licenses.unshift(newLicense);
        await saveLicenses(licenses);
        
        if (settings.logging.enabled && settings.logging.logBuiltByBit) {
            await sendWebhook({
                title: 'New Purchase via BuiltByBit Webhook',
                description: `A new license has been created from a BuiltByBit purchase.`,
                color: 0x0ea5e9, // sky-500
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
