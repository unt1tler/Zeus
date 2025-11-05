import { getProducts } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { ProductClient } from "@/components/products/ProductClient";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Products"
        description="Create and manage your products."
      />
      <ProductClient products={products} />
    </div>
  );
}
