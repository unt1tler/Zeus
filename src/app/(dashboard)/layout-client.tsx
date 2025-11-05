
"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DashboardLayoutClient({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: React.ReactNode;
}) {

  return (
    <TooltipProvider delayDuration={0}>
        <div className="flex min-h-screen">
            {navigation}
            <ScrollArea className="h-screen flex-1 bg-background">
                <main className="flex-1 p-6 md:p-8">
                    {children}
                </main>
            </ScrollArea>
        </div>
    </TooltipProvider>
  );
}
