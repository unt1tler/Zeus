

import { getDashboardStats, getSettings } from "@/lib/data";
import { getBotStatus } from "@/lib/actions";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const [{ logs: allLogs, licenses: allLicenses, ...stats }, settings, botStatus] = await Promise.all([
    getDashboardStats(),
    getSettings(),
    getBotStatus(),
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
