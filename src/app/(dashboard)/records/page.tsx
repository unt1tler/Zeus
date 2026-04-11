

import { getLogs, getLicenses, getBlacklist } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { RecordsClient } from "@/components/records/RecordsClient";
import type { ValidationLog, License, Blacklist } from "@/lib/types";

export interface EnrichedValidationLog extends ValidationLog {
  customerUsername?: string;
}

export default async function RecordsPage() {
  const [logs, licenses, blacklist] = await Promise.all([
    getLogs(),
    getLicenses(),
    getBlacklist(),
  ]) as [ValidationLog[], License[], Blacklist];

  const licenseMap = new Map<string, License>();
  licenses.forEach(l => licenseMap.set(l.key, l));

  const enrichedLogs: EnrichedValidationLog[] = logs.map(log => {
      const license = licenseMap.get(log.licenseKey);
      return {
          ...log,
          customerUsername: license?.discordUsername,
      }
  })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Validation Records"
        description="A log of all license validation requests."
      />
      <RecordsClient logs={enrichedLogs} licenses={licenses} blacklist={blacklist} />
    </div>
  );
}
