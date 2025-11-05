
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { Bot, AlertCircle, Save, Play, Mic, Eye, Gamepad2, BarChart } from "lucide-react";
import { updateSettings } from "@/lib/actions";
import type { DiscordBotSettings, BotStatus, DailyCommandUsage } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CommandUsageChart } from "../dashboard/CommandUsageChart";

const settingsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required."),
  guildId: z.string().min(1, "Guild ID is required."),
  botSecret: z.string().optional(),
  presence: z.object({
    status: z.enum(['online', 'idle', 'dnd']),
    activity: z.object({
      type: z.enum(['Playing', 'Streaming', 'Listening', 'Watching', 'Competing']),
      name: z.string().min(1, "Activity name cannot be empty."),
    }),
  }),
});

const activityIcons = {
    Playing: <Gamepad2 className="h-4 w-4 text-muted-foreground" />,
    Streaming: <Mic className="h-4 w-4 text-muted-foreground" />,
    Listening: <Mic className="h-4 w-4 text-muted-foreground" />,
    Watching: <Eye className="h-4 w-4 text-muted-foreground" />,
    Competing: <Gamepad2 className="h-4 w-4 text-muted-foreground" />,
    default: <Play className="h-4 w-4 text-muted-foreground" />,
}

interface DiscordSettingsClientProps {
  initialSettings: DiscordBotSettings;
  initialStatus: BotStatus;
  commandUsageData: DailyCommandUsage[];
}


export function DiscordSettingsClient({ initialSettings, initialStatus, commandUsageData }: DiscordSettingsClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const botStatus = initialStatus;

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      clientId: initialSettings.clientId || "",
      guildId: initialSettings.guildId || "",
      botSecret: initialSettings.botSecret || "",
      presence: initialSettings.presence,
    },
  });

  const handleSettingsUpdate = (data: z.infer<typeof settingsSchema>) => {
    startTransition(async () => {
      const result = await updateSettings({ 
        discordBot: {
            ...initialSettings,
            ...data
        }
      });
      if (result.success) {
        toast({ title: "Success", description: "Discord bot settings have been saved. They will be applied on the next bot restart." });
        router.refresh();
      } else {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    });
  };
  
  const activityIcon = botStatus.presence?.activity.type ? activityIcons[botStatus.presence.activity.type] : activityIcons.default;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSettingsUpdate)}>
                <Card className="min-h-[580px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Bot Settings</CardTitle>
                        <CardDescription>Manage your bot's configuration and live presence.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 flex-1">
                       <div>
                            <FormLabel>Configuration</FormLabel>
                            <div className="grid sm:grid-cols-2 gap-4 mt-2">
                                <FormField
                                    control={form.control}
                                    name="clientId"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel className="text-xs">Client ID</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="guildId"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel className="text-xs">Guild ID</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <div className="sm:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="botSecret"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel className="text-xs">Bot Secret</FormLabel>
                                            <FormControl><Input type="password" {...field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                       </div>
                        <div>
                           <FormLabel>Presence</FormLabel>
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                                <FormField
                                    control={form.control}
                                    name="presence.status"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel className="text-xs">Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="online">Online</SelectItem>
                                                <SelectItem value="idle">Idle</SelectItem>
                                                <SelectItem value="dnd">Do Not Disturb</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="presence.activity.type"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel className="text-xs">Activity</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Playing">Playing</SelectItem>
                                                <SelectItem value="Watching">Watching</SelectItem>
                                                <SelectItem value="Listening">Listening</SelectItem>
                                                <SelectItem value="Streaming">Streaming</SelectItem>
                                                <SelectItem value="Competing">Competing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                               <div className="sm:col-span-3">
                                    <FormField
                                        control={form.control}
                                        name="presence.activity.name"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel className="text-xs">Activity Name</FormLabel>
                                            <FormControl><Input placeholder="e.g. your licenses" {...field} /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                               </div>
                            </div>
                       </div>
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" disabled={isPending}>
                            <Save className="mr-2"/>
                            {isPending ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </CardFooter>
                </Card>
              </form>
            </Form>
        </div>
        <div className="lg:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Bot Status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            {botStatus.avatarUrl ? <Image src={botStatus.avatarUrl} alt="Bot Avatar" width={48} height={48} className="rounded-full" /> : <Bot className="h-12 w-12 text-muted-foreground"/>}
                        <div className="flex-1">
                                <h3 className="font-bold text-lg">{botStatus.username || 'Discord Bot'}</h3>
                                <div className="flex items-center gap-2 text-sm">
                                <div className={`h-2.5 w-2.5 rounded-full 
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
                            <AlertCircle className="h-4 w-4 mt-0.5"/>
                            <span>{botStatus.error}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <BarChart className="h-6 w-6"/>
                        <div>
                            <CardTitle>Command Usage</CardTitle>
                            <CardDescription>Last 7 days</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <CommandUsageChart data={commandUsageData} />
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
