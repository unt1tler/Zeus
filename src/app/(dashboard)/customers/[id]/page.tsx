

import { getLicenses, getProducts, getBlacklist, fetchDiscordUser, getAllUsers } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import type { License, Product } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Ban, Pencil, Mail } from "lucide-react";
import { CustomerProfileClient } from "@/components/customers/CustomerProfileClient";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";


interface EnrichedLicense extends License {
  productName: string;
}

interface CustomerDetails {
  customer: {
    id: string;
    discordUsername?: string;
    email?: string;
    avatarUrl?: string;
  };
  ownedLicenses: EnrichedLicense[];
  subUserLicenses: EnrichedLicense[];
  isBlacklisted: boolean;
}

async function getCustomerDetails(
  customerId: string
): Promise<CustomerDetails | null> {
  const allLicenses = await getLicenses();
  const allProducts = await getProducts();
  const blacklist = await getBlacklist();
  
  const ownedLicenses = allLicenses.filter(l => l.discordId === customerId);
  const subUserLicenses = allLicenses.filter(l => (l.subUserDiscordIds || []).includes(customerId));
  
  if (ownedLicenses.length === 0 && subUserLicenses.length === 0) {
    const allUsers = await getAllUsers();
    if (!allUsers.some(u => u.id === customerId)) {
        return null;
    }
  }
  
  const getProductName = (productId: string) => allProducts.find(p => p.id === productId)?.name || "N/A";
  
  const enrichedOwnedLicenses = ownedLicenses.map(l => ({
      ...l,
      productName: getProductName(l.productId),
  }));

  const enrichedSubUserLicenses = subUserLicenses.map(l => ({
      ...l,
      productName: getProductName(l.productId),
  }));
  
  const discordUser = await fetchDiscordUser(customerId);
  const firstOwnedLicense = ownedLicenses[0];
  
  const username = discordUser?.username || firstOwnedLicense?.discordUsername || subUserLicenses[0]?.discordUsername || customerId;
  const email = firstOwnedLicense?.email;
  
  const customer = {
    id: customerId,
    discordUsername: username,
    email: email,
    avatarUrl: discordUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
  };
  
  const isBlacklisted = blacklist.discordIds.includes(customerId);

  return { customer, ownedLicenses: enrichedOwnedLicenses, subUserLicenses: enrichedSubUserLicenses, isBlacklisted };
}

export default async function CustomerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const customerData = await getCustomerDetails(params.id);

  if (!customerData) {
    notFound();
  }

  const { customer, ownedLicenses, subUserLicenses, isBlacklisted } = customerData;
  const products = await getProducts();
  const allLicenses = await getLicenses();
  const allUsers = await getAllUsers();
  const blacklist = await getBlacklist();
  
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border">
          <AvatarImage
            src={customer.avatarUrl}
            alt={customer.discordUsername || customer.id}
          />
          <AvatarFallback>
            <User className="h-10 w-10" />
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {customer.discordUsername || customer.id}
             </h1>
             {isBlacklisted && <Badge variant="destructive" className="h-fit"><Ban className="mr-2"/>Blacklisted</Badge>}
          </div>
          <p className="text-muted-foreground">{customer.id}</p>
        </div>
      </div>

      <CustomerProfileClient 
        customer={customer}
        ownedLicenses={ownedLicenses}
        subUserLicenses={subUserLicenses}
        products={products}
        allLicenses={allLicenses}
        allUsers={allUsers}
        isBlacklisted={isBlacklisted}
        blacklist={blacklist}
      />
    </div>
  );
}
