

"use client";

import { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import type { ValidationLog } from "@/lib/types";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function InteractiveMap({ logs }: { logs: ValidationLog[] }) {
    const logsByCountry = useMemo(() => {
        return logs.reduce((acc, log) => {
        if (log.location?.country) {
            const country = log.location.country;
            if (!acc[country]) {
            acc[country] = [];
            }
            acc[country].push(log);
        }
        return acc;
        }, {} as Record<string, ValidationLog[]>);
    }, [logs]);

    const markers = useMemo(() => logs.filter(log => log.location?.coordinates), [logs]);

  return (
    <div className="relative h-full w-full">
        <ComposableMap
          projectionConfig={{
            scale: 250,
            center: [0, 20]
          }}
          style={{ width: "100%", height: "100%" }}
        >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name;
                  const hasLogs = logsByCountry[countryName];
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: hasLogs
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted))",
                          outline: "none",
                        },
                        hover: {
                          fill: "hsl(var(--primary) / 0.8)",
                          outline: "none",
                        },
                        pressed: {
                          fill: "hsl(var(--primary))",
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {markers.map((log) => (
                log.location?.coordinates && (
                    <Marker key={log.id} coordinates={log.location.coordinates}>
                        <circle r={2} fill={log.status === 'success' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'} stroke="#fff" strokeWidth={0.5} />
                    </Marker>
                )
            ))}
        </ComposableMap>
      </div>
  );
}
