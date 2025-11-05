
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  KeyRound,
  FileClock,
  Settings,
  Users,
  Ban,
  PanelLeft,
  Bot,
  Code,
  ShieldQuestion,
  LogOut,
} from "lucide-react";
import { Nav } from "@/components/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/lib/actions";

interface DashboardNavProps {
    discordBotEnabled: boolean;
}

export function DashboardNav({ discordBotEnabled }: DashboardNavProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const mainNavItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/products", icon: ShoppingBag, label: "Products" },
    { href: "/licenses", icon: KeyRound, label: "Licenses" },
    { href: "/customers", icon: Users, label: "Customers" },
    { href: "/records", icon: FileClock, label: "Records" },
    { href: "/blacklist", icon: Ban, label: "Blacklist" },
    { href: "/integration", icon: ShieldQuestion, label: "Integration" },
  ];

  const discordNavItems = discordBotEnabled ? [
    { isSeparator: true, title: "Discord Bot", icon: Bot },
    { href: "/settings/discord", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/settings/discord/management", icon: Code, label: "Management" }
  ] : [];
  
  const settingsItem = { href: "/settings", icon: Settings, label: "Settings" };

  return (
    <div
      className={cn(
        "relative flex flex-col h-screen border-r bg-card transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className={cn("flex h-[60px] items-center border-b px-6", isCollapsed ? "justify-center" : "justify-between")}>
        <Link href="/" className={cn("flex items-center gap-2 font-semibold", isCollapsed && "hidden")}>
          <span className={cn("text-lg transition-opacity", isCollapsed && "sr-only")}>Zeus</span>
        </Link>
         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar}>
            <PanelLeft className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <Nav isCollapsed={isCollapsed} links={mainNavItems} pathname={pathname} />
        {discordBotEnabled && (
            <div className="mt-4">
                 <Nav isCollapsed={isCollapsed} links={discordNavItems} pathname={pathname} />
            </div>
        )}
      </div>

      <div className="mt-auto border-t p-2">
         <Nav isCollapsed={isCollapsed} links={[settingsItem]} pathname={pathname} />
         <form action={logout} className="mt-1">
            {isCollapsed ? (
                 <Button variant="ghost" size="icon" className="w-full h-9" type="submit">
                    <LogOut className="h-5 w-5" />
                </Button>
            ) : (
                <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2 text-muted-foreground" type="submit">
                    <LogOut className="h-4 w-4 ml-1" />
                    Logout
                </Button>
            )}
         </form>
      </div>
    </div>
  );
}
