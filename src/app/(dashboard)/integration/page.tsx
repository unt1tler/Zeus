
import { PageHeader } from "@/components/PageHeader";
import { getSettings } from "@/lib/data";
import { ValidationApiSettings } from "./ValidationApiSettings";
import { IntegrationNav } from "./IntegrationNav";

export default async function IntegrationPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="API & Integration Guide"
        description="Integrate the license system into your application."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12 items-start">
        <div className="lg:col-span-1">
             <ValidationApiSettings settings={settings} />
        </div>
        <div className="lg:col-span-1 sticky top-8">
            <IntegrationNav />
        </div>
      </div>
    </div>
  );
}
