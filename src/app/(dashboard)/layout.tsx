import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardNav } from "./DashboardNav";
import { DashboardLayoutClient } from "./layout-client";
import { getSettings } from "@/lib/data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const session = cookieStore.get("session");

  if (!session?.value) {
    redirect("/admin/login");
  }

  if (session.value !== process.env.SESSION_SECRET) {
     redirect("/admin/login");
  }


  const settings = await getSettings();
  const isBotEnabled = settings.discordBot?.enabled ?? false;

  return (
    <DashboardLayoutClient navigation={<DashboardNav discordBotEnabled={isBotEnabled} />}>
      {children}
    </DashboardLayoutClient>
  );
}
