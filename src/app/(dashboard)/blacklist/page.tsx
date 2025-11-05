
import { getBlacklist, getLogs, fetchDiscordUser } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { BlacklistClient } from "@/components/blacklist/BlacklistClient";
import type { BlacklistedUser } from "@/lib/types";

export default async function BlacklistPage() {
  const blacklist = await getBlacklist();
  const allLogs = await getLogs();

  const blacklistedLogs = allLogs.filter(log => 
    (log.reason?.toLowerCase().includes('blacklist'))
  );

  const blacklistedUsersPromises: Promise<BlacklistedUser>[] = blacklist.discordIds.map(async id => {
    const user = await fetchDiscordUser(id);
    return {
      id: id,
      username: user?.username || id,
      avatarUrl: user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || id)}&background=random`,
    }
  });

  const blacklistedUsers = await Promise.all(blacklistedUsersPromises);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Blacklist Management"
        description="Block specific IP addresses, HWIDs, and users from accessing your application."
      />
      <BlacklistClient blacklist={blacklist} logs={blacklistedLogs} blacklistedUsers={blacklistedUsers} />
    </div>
  );
}
