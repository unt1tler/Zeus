
import { PageHeader } from "@/components/PageHeader";
import { IntegrationNav } from "../IntegrationNav";
import { getSettings } from "@/lib/data";
import { BuiltByBitPlaceholderClient } from "@/components/integration/BuiltByBitPlaceholderClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default async function BuiltByBitPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="BuiltByBit Placeholder Automation"
        description="Automate lifetime license creation when a user downloads your product for the first time."
      />
       <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>For One-Time Purchases Only</AlertTitle>
        <AlertDescription>
          This automation method is designed for products with one-time pricing. It generates a lifetime license upon the user's first download.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12 items-start">
        <div className="lg:col-span-1">
          <BuiltByBitPlaceholderClient settings={settings} />
        </div>
        <div className="lg:col-span-1 sticky top-8">
          <IntegrationNav />
        </div>
      </div>
    </div>
  );
}
