
import { getSettings } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const settings = await getSettings();
  
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Manage your application settings and API keys."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
