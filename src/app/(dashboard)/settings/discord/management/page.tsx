
import { PageHeader } from "@/components/PageHeader";
import { getSettings } from "@/lib/data";
import { DiscordManagementClient } from "@/components/settings/DiscordManagementClient";
import type { DiscordBotSettings } from "@/lib/types";

export default async function DiscordManagementPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Bot Management"
        description="Configure bot administrators and toggle which commands are enabled."
      />
      <DiscordManagementClient initialSettings={settings.discordBot} />
    </div>
  );
}
