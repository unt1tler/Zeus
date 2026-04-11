import { DashboardNav } from "./DashboardNav";
import { DashboardLayoutClient } from "./layout-client";
import { getSettings } from "@/lib/data";
import { requireAdminSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();
  const settings = await getSettings();
  const isBotEnabled = settings.discordBot?.enabled ?? false;

  return (
    <DashboardLayoutClient navigation={<DashboardNav discordBotEnabled={isBotEnabled} />}>
      {children}
    </DashboardLayoutClient>
  );
}
