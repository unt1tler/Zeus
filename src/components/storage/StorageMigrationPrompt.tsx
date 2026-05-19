"use client";

import * as React from "react";
import { Database, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { migrateActiveStorageBackend } from "@/lib/actions";
import type { StorageBackend, StorageMigrationStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const backendLabels: Record<StorageBackend, string> = {
  json: "JSON file storage",
  postgresql: "PostgreSQL",
};

const collectionLabels: Record<string, string> = {
  "settings.json": "Settings",
  "products.json": "Products",
  "licenses.json": "Licenses",
  "platform-links.json": "Platform links",
  "logs.json": "Validation logs",
  "bot-logs.json": "Bot logs",
  "vouchers.json": "Vouchers",
  "blacklist.json": "Blacklist entries",
};

type StorageMigrationPromptProps = {
  status: StorageMigrationStatus;
};

export function StorageMigrationPrompt({ status }: StorageMigrationPromptProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dismissed, setDismissed] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  if (dismissed || !status.available || !status.needsMigration) {
    return null;
  }

  const sourceLabel = backendLabels[status.sourceBackend];
  const destinationLabel = backendLabels[status.activeBackend];
  const sourceCollections = Object.entries(status.sourceSummary.collections)
    .filter((entry) => entry[1] > 0)
    .sort((a, b) => b[1] - a[1]);
  const visibleCollections = sourceCollections.slice(0, 6);
  const hiddenCollectionCount = Math.max(0, sourceCollections.length - visibleCollections.length);

  function handleMigration() {
    startTransition(async () => {
      const result = await migrateActiveStorageBackend();

      if (result.success) {
        toast({
          title: result.migrated ? "Storage migrated" : "Storage checked",
          description: result.message,
        });
        router.refresh();
        setDismissed(true);
        return;
      }

      toast({
        title: "Migration failed",
        description: result.message,
        variant: "destructive",
      });
    });
  }

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
      <Database className="h-4 w-4" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <AlertTitle>Storage migration available</AlertTitle>
            <AlertDescription className="mt-1 max-w-4xl text-amber-900 dark:text-amber-100/80">
              Active backend is {destinationLabel}. Data was found in {sourceLabel}. The source remains untouched and the current destination is backed up before migration.
            </AlertDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleCollections.map(([collection, count]) => (
              <Badge
                key={collection}
                variant="outline"
                className="border-amber-300 bg-white/70 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
              >
                {collectionLabels[collection] ?? collection}: {count}
              </Badge>
            ))}
            {hiddenCollectionCount > 0 ? (
              <Badge
                variant="outline"
                className="border-amber-300 bg-white/70 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
              >
                +{hiddenCollectionCount} more
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 bg-white/70 text-amber-950 hover:bg-white dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
            onClick={() => setDismissed(true)}
            disabled={isPending}
          >
            <X className="h-4 w-4" />
            Not now
          </Button>
          <Button type="button" onClick={handleMigration} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Migrate data
          </Button>
        </div>
      </div>
    </Alert>
  );
}
