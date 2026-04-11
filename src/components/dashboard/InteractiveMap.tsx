"use client";

import { useMemo } from "react";
import type { ValidationLog } from "@/lib/types";

type ProjectedMarker = {
  id: string;
  x: number;
  y: number;
  status: ValidationLog["status"];
  city: string;
  country: string;
};

export function InteractiveMap({ logs }: { logs: ValidationLog[] }) {
  const countryCounts = useMemo(() => {
    return logs.reduce((acc, log) => {
      const country = log.location?.country;
      if (country) {
        acc[country] = (acc[country] ?? 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [logs]);

  const markers = useMemo<ProjectedMarker[]>(() => {
    return logs.flatMap((log) => {
      const coordinates = log.location?.coordinates;
      if (!coordinates) {
        return [];
      }

      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return [];
      }

      const normalizedX = ((longitude + 180) / 360) * 100;
      const normalizedY = ((90 - latitude) / 180) * 100;

      return [
        {
          id: log.id,
          x: Math.min(100, Math.max(0, normalizedX)),
          y: Math.min(100, Math.max(0, normalizedY)),
          status: log.status,
          city: log.location?.city || "Unknown city",
          country: log.location?.country || "Unknown country",
        },
      ];
    });
  }, [logs]);

  const topCountries = useMemo(() => {
    return Object.entries(countryCounts)
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 5);
  }, [countryCounts]);

  const successCount = logs.filter((log) => log.status === "success").length;
  const failureCount = logs.length - successCount;
  const displayMarkers = markers.slice(-150);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.14),_transparent_48%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))]">
      <div className="absolute inset-x-[8%] inset-y-[10%] rounded-[999px] border border-border/60 bg-background/20 shadow-inner" />

      {[22, 35, 50, 65, 78].map((line) => (
        <div
          key={`lat-${line}`}
          className="absolute left-[8%] right-[8%] border-t border-white/10"
          style={{ top: `${line}%` }}
        />
      ))}

      {[18, 34, 50, 66, 82].map((line) => (
        <div
          key={`lon-${line}`}
          className="absolute bottom-[10%] top-[10%] border-l border-white/10"
          style={{ left: `${line}%` }}
        />
      ))}

      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium">
          Mapped requests: {markers.length}
        </div>
        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
          Success: {successCount}
        </div>
        <div className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-300">
          Failure: {failureCount}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 w-56 rounded-xl border border-border/60 bg-background/85 p-3 shadow-sm backdrop-blur">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Top Countries
        </p>
        <div className="space-y-2">
          {topCountries.length > 0 ? (
            topCountries.map(([country, count]) => (
              <div key={country} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">{country}</span>
                  <span className="font-mono text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(12, (count / topCountries[0][1]) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No location data has been recorded yet.
            </p>
          )}
        </div>
      </div>

      {displayMarkers.map((marker) => (
        <div
          key={marker.id}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${8 + marker.x * 0.84}%`,
            top: `${10 + marker.y * 0.8}%`,
          }}
          title={`${marker.city}, ${marker.country}`}
        >
          <span
            className={`block h-2.5 w-2.5 rounded-full border border-white/70 shadow ${
              marker.status === "success" ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>
      ))}

      {markers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-dashed border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
            Validation markers will appear here once requests include geolocation data.
          </div>
        </div>
      )}
    </div>
  );
}
