

import { PageHeader } from "@/components/PageHeader";
import { getBotStatus } from "@/lib/actions";
import { DiscordSettingsClient } from "@/components/settings/DiscordSettingsClient";
import type { DiscordBotSettings } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bot } from "lucide-react";
import { getSettings, getCommandUsageData } from "@/lib/data";

export default async function DiscordSettingsPage() {
  const settings = await getSettings();
  const botStatus = await getBotStatus();
  const commandUsageData = await getCommandUsageData();
  
  if (!settings.discordBot.enabled) {
    return (
        <div className="flex flex-col gap-8">
            <PageHeader
            title="Discord Bot Dashboard"
            description="Manage your Discord bot's status and presence."
            />
            <Alert>
                <Bot className="h-4 w-4" />
                <AlertTitle>Bot Disabled</AlertTitle>
                <AlertDescription>
                    The Discord bot is currently disabled. Enable it in the 
                    <a href="/settings" className="font-bold underline"> General Settings</a> page to manage it here.
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Discord Bot Dashboard"
        description="Manage your Discord bot's status and presence."
      />

      <DiscordSettingsClient 
        initialSettings={settings.discordBot} 
        initialStatus={botStatus}
        commandUsageData={commandUsageData}
      />
    </div>
  );
}

    