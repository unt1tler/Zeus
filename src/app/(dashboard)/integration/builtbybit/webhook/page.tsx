
import { PageHeader } from "@/components/PageHeader";
import { IntegrationNav } from "../../IntegrationNav";
import { BuiltByBitWebhookClient } from "@/components/integration/BuiltByBitWebhookClient";
import { getSettings, getDashboardStats } from "@/lib/data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, BarChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WebhookCreationsChart } from "@/components/dashboard/WebhookCreationsChart";

export default async function BuiltByBitWebhookPage() {
  const settings = await getSettings();
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="BuiltByBit Purchase Webhook"
        description="Automate license creation and renewal by connecting to BuiltByBit's purchase webhooks."
      />
       <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>For One-Time Purchases Only</AlertTitle>
        <AlertDescription>
          This webhook integration is designed to create lifetime licenses for one-time purchases and does not handle renewals.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12 items-start">
        <div className="lg:col-span-1 space-y-8">
          <BuiltByBitWebhookClient settings={settings} />
           <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <BarChart className="h-6 w-6"/>
                    <div>
                        <CardTitle>Webhook Creations</CardTitle>
                        <CardDescription>New licenses created via webhooks in the last 7 days.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <WebhookCreationsChart data={stats.dailyWebhookCreations || []} />
            </CardContent>
           </Card>
        </div>
        <div className="lg:col-span-1 sticky top-8">
          <IntegrationNav />
        </div>
      </div>
    </div>
  );
}
