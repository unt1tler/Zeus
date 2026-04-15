
"use client";

import { useState, useEffect } from "react";
import type { BotStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, AlertCircle, Play, Mic, Eye, Gamepad2, RefreshCw } from "lucide-react";
import Image from "next/image";

const activityIcons = {
    Playing: <Gamepad2 className="h-4 w-4 text-muted-foreground" />,
    Streaming: <Mic className="h-4 w-4 text-muted-foreground" />,
    Listening: <Mic className="h-4 w-4 text-muted-foreground" />,
    Watching: <Eye className="h-4 w-4 text-muted-foreground" />,
    Competing: <Gamepad2 className="h-4 w-4 text-muted-foreground" />,
    default: <Play className="h-4 w-4 text-muted-foreground" />,
}

async function requestBotStatus(): Promise<BotStatus | null> {
  try {
    const response = await fetch("/api/bot/status", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401 || !response.ok) {
      return null;
    }

    return (await response.json()) as BotStatus;
  } catch {
    return null;
  }
}

export function DiscordStatusWidget({ initialStatus }: { initialStatus: BotStatus }) {
  const [botStatus, setBotStatus] = useState<BotStatus>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const refreshStatus = async () => {
      const status = await requestBotStatus();
      if (!status || cancelled) {
        return;
      }

      setBotStatus(status);

      if (status.status === "starting" && document.visibilityState === "visible") {
        timeoutId = window.setTimeout(() => {
          void refreshStatus();
        }, 5000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return;
      }

      void refreshStatus();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    if (botStatus.status === "starting" && document.visibilityState === "visible") {
      timeoutId = window.setTimeout(() => {
        void refreshStatus();
      }, 5000);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [botStatus.status]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      const status = await requestBotStatus();
      if (status) {
        setBotStatus(status);
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const activityIcon = botStatus.presence?.activity.type ? activityIcons[botStatus.presence.activity.type] : activityIcons.default;


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Bot Status</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh bot status"
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
            {botStatus.avatarUrl ? (
            <Image src={botStatus.avatarUrl} alt="Bot Avatar" width={48} height={48} className="rounded-full" />
            ) : (
            <Bot className="h-12 w-12 text-muted-foreground" />
            )}
            <div className="flex-1">
            <h3 className="font-bold text-lg">{botStatus.username || 'Discord Bot'}</h3>
            <div className="flex items-center gap-2 text-sm">
                <div
                className={`h-2.5 w-2.5 rounded-full 
                    ${botStatus.status === 'online' ? 'bg-green-500' :
                    botStatus.status === 'starting' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500'}`}
                />
                <span className="text-muted-foreground capitalize">{botStatus.status}</span>
            </div>
            </div>
        </div>

        {botStatus.status === 'online' && botStatus.presence && (
            <div className="flex items-center gap-2 text-sm ml-1 pl-4 border-l-2">
                {activityIcon}
                <span className="text-muted-foreground">{botStatus.presence.activity.type}</span>
                <span className="font-semibold text-foreground truncate">{botStatus.presence.activity.name}</span>
            </div>
        )}
        
        {botStatus.error && (
            <div className="text-sm text-destructive-foreground bg-destructive/80 p-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{botStatus.error}</span>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
