
import { getDashboardStats, getSettings } from "@/lib/data";
import { getBotStatusSnapshot } from "@/lib/bot-status";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const [{ logs: allLogs, licenses: allLicenses, ...stats }, settings, botStatus] = await Promise.all([
    getDashboardStats(),
    getSettings(),
    getBotStatusSnapshot(),
  ]);

  return (
    <DashboardClient
      stats={stats}
      allLogs={allLogs}
      allLicenses={allLicenses}
      settings={settings}
      botStatus={botStatus}
    />
  );
}
