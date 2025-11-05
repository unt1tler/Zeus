

import { getDashboardStats, getLogs, getLicenses, getSettings } from "@/lib/data";
import { getBotStatus } from "@/lib/actions";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const allLogs = await getLogs();
  const allLicenses = await getLicenses();
  const settings = await getSettings();
  const botStatus = await getBotStatus();

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
