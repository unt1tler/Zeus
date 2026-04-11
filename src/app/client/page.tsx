"use server"

import { cookies } from "next/headers";
import { redirect } from 'next/navigation';
import type { ClientUser, License, Product, Customer } from "@/lib/types";
import { getLicenses, getProducts, getCustomerProfile } from "@/lib/data";
import { LicenseManagementClient } from "@/components/client/LicenseManagementClient";
import { verifySignedCookie } from "@/lib/auth";

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
            ...l,
            productName: product?.name || 'N/A',
            productImageUrl: product?.imageUrl || `https://picsum.photos/seed/${l.productId}/400/300`,
            isOwner: l.discordId === userId,
        };
    });

    return { 
        licenses: enrichedLicenses, 
        allProducts,
        userProfile,
    };
}


export default async function ClientDashboardPage() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
        redirect('/login');
    }

    const user = verifySignedCookie(userCookie.value);
    if (!user) {
        redirect('/login');
    }
    
    const { licenses, allProducts, userProfile } = await getClientData(user.id);
    
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
            products={allProducts} 
            user={user} 
            userProfile={userProfile ?? undefined}
            ipUsage={{ used: allUserIps.size, total: allIpSlots }} 
        />
    );
}
