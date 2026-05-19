
"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StorageMigrationPrompt } from "@/components/storage/StorageMigrationPrompt";
import type { StorageMigrationStatus } from "@/lib/types";

export function DashboardLayoutClient({
  children,
  navigation,
  storageMigrationStatus,
}: {
  children: React.ReactNode;
  navigation: React.ReactNode;
  storageMigrationStatus: StorageMigrationStatus;
}) {

  return (
    <TooltipProvider delayDuration={0}>
        <div className="flex min-h-screen">
            {navigation}
            <ScrollArea className="h-screen flex-1 bg-background">
                <main className="flex-1 p-6 md:p-8">
                    <StorageMigrationPrompt status={storageMigrationStatus} />
                    {children}
                </main>
            </ScrollArea>
        </div>
    </TooltipProvider>
  );
}
