import { DashboardNav } from "./DashboardNav";
import { DashboardLayoutClient } from "./layout-client";
import { getSettings, getStorageMigrationStatus } from "@/lib/data";
import { requireAdminSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();
  const [settings, storageMigrationStatus] = await Promise.all([
    getSettings(),
    getStorageMigrationStatus(),
  ]);
  const isBotEnabled = settings.discordBot?.enabled ?? false;

  return (
    <DashboardLayoutClient
      navigation={<DashboardNav discordBotEnabled={isBotEnabled} />}
      storageMigrationStatus={storageMigrationStatus}
    >
      {children}
    </DashboardLayoutClient>
  );
}
