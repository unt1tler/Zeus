
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "./ui/separator";

interface NavLink {
    href?: string;
    label?: string;
    icon?: LucideIcon;
    isTitle?: boolean;
    title?: string;
    isSeparator?: boolean;
}

interface NavProps {
  isCollapsed: boolean;
  links: NavLink[];
  pathname: string;
}

export function Nav({ links, isCollapsed, pathname }: NavProps) {
  
  return (
    <div
      data-collapsed={isCollapsed}
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) => {
          if (link.isSeparator) {
              if (link.title && link.icon) {
                const Icon = link.icon;
                if (isCollapsed) {
                     return (
                        <Separator key={index} className="my-2" />
                     )
                }
                return (
                  <div key={index} className="relative my-2">
                    <Separator />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Icon className="h-3 w-3" />
                        {link.title}
                      </div>
                    </div>
                  </div>
                )
              }
              return <Separator key={index} className="my-2" />;
          }
          if (link.isTitle && link.icon) {
              const Icon = link.icon;
              if (isCollapsed) {
                   return (
                     <Tooltip key={index} delayDuration={0}>
                      <TooltipTrigger className="my-2 flex h-9 w-9 items-center justify-center">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-4 bg-accent text-foreground border-border">
                          {link.title}
                      </TooltipContent>
                  </Tooltip>
                   )
              }
              return (
                  <h4 key={index} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      {link.title}
                  </h4>
              )
          }

          if (link.href && link.label && link.icon) {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return isCollapsed ? (
                <Tooltip key={index} delayDuration={0}>
                <TooltipTrigger asChild>
                    <Link
                    href={link.href}
                    className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent",
                        isActive && "bg-accent text-foreground"
                    )}
                    >
                    {isActive && <div className="absolute left-0 h-6 w-1 rounded-r-full bg-primary" />}
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{link.label}</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-4 bg-accent text-foreground border-border">
                    {link.label}
                </TooltipContent>
                </Tooltip>
            ) : (
                <Link
                key={index}
                href={link.href}
                className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground hover:bg-accent",
                    isActive && "bg-accent text-foreground"
                )}
                >
                {isActive && <div className="absolute left-0 h-6 w-1 rounded-r-full bg-primary" />}
                <Icon className="h-4 w-4 ml-1" />
                {link.label}
                </Link>
            )
          }
          return null;
        })}
      </nav>
    </div>
  );
}
