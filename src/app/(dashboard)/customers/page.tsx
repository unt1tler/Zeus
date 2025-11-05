

import { getAllUsers } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { CustomersClient } from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const customers = await getAllUsers();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Customers"
        description="An overview of all your license holders and sub-users."
      />
      <CustomersClient customers={customers} />
    </div>
  );
}
