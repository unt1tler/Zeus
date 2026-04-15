"use server"

import { getLicenses, getProducts, getCustomerProfile } from "@/lib/data";
import { LicenseManagementClient } from "@/components/client/LicenseManagementClient";
import { requireAuthenticatedClientUser } from "@/lib/auth";

async function getClientData(userId: string) {
    const [allLicenses, allProducts, userProfile] = await Promise.all([
        getLicenses(),
        getProducts(),
        getCustomerProfile(userId),
    ]);

    const userLicenses = allLicenses.filter(
        (l) => l.discordId === userId || (l.subUserDiscordIds || []).includes(userId)
    );
    
    const enrichedLicenses = userLicenses.map(l => {
        const product = allProducts.find(p => p.id === l.productId);
        return {
            key: l.key,
            productId: l.productId,
            expiresAt: l.expiresAt,
            status: l.status,
            allowedIps: l.allowedIps,
            maxIps: l.maxIps,
            allowedHwids: l.allowedHwids,
            maxHwids: l.maxHwids,
            createdAt: l.createdAt,
            productName: product?.name || 'N/A',
            productImageUrl: product?.imageUrl || `https://picsum.photos/seed/${l.productId}/400/300`,
            isOwner: l.discordId === userId,
        };
    });

    const visibleProductIds = new Set(enrichedLicenses.map((license) => license.productId));
    const clientProducts = allProducts
      .filter((product) => visibleProductIds.has(product.id))
      .map((product) => ({
        id: product.id,
        hwidProtection: product.hwidProtection,
        builtByBitResourceId: product.builtByBitResourceId,
      }));

    return { 
        licenses: enrichedLicenses, 
        products: clientProducts,
        userProfile,
    };
}


export default async function ClientDashboardPage() {
    const user = await requireAuthenticatedClientUser();
    
    const { licenses, products, userProfile } = await getClientData(user.id);
    
    const allUserIps = new Set<string>();
    licenses.forEach(license => {
        if (license.maxIps !== -2) {
          license.allowedIps.forEach(ip => allUserIps.add(ip));
        }
    });

    const allIpSlots = licenses.reduce((acc, license) => {
        if (license.maxIps > 0) return acc + license.maxIps;
        if (license.maxIps === -1) return Infinity;
        return acc;
    }, 0);

    return (
        <LicenseManagementClient 
            licenses={licenses} 
            products={products} 
            user={user} 
            userProfile={userProfile ?? undefined}
            ipUsage={{ used: allUserIps.size, total: allIpSlots }} 
        />
    );
}
