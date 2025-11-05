
import { getLicenses, getProducts, getAllUsers } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { LicenseClient } from "@/components/licenses/LicenseClient";
import { StatCard } from "@/components/dashboard/StatCard";
import { KeyRound, CheckCircle, XCircle } from "lucide-react";
import type { License, Product, Customer } from "@/lib/types";

export default async function LicensesPage() {
  const licenses: (License & { productName: string })[] = await getLicenses().then(async (licenses) => {
    const products = await getProducts();
    return licenses.map((license) => {
      const product = products.find((p) => p.id === license.productId);
      return { ...license, productName: product?.name || "N/A" };
    });
  });
  
  const products = await getProducts();
  const allUsers = await getAllUsers();

  const now = new Date();
  const totalLicenses = licenses.length;
  const activeLicenses = licenses.filter(l => l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt) > now)).length;
  const expiredLicenses = licenses.filter(l => l.status === 'expired' || (l.expiresAt && new Date(l.expiresAt) <= now)).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Licenses"
        description="Create and manage your license keys."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          title="Total Licenses"
          value={totalLicenses}
          icon={KeyRound}
        />
        <StatCard
          title="Total Active Licenses"
          value={activeLicenses}
          icon={CheckCircle}
        />
        <StatCard
          title="Total Expired Licenses"
          value={expiredLicenses}
          icon={XCircle}
        />
      </div>
      <LicenseClient licenses={licenses} products={products} allUsers={allUsers} />
    </div>
  );
}
