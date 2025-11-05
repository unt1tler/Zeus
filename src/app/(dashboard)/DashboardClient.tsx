
"use client";

import dynamic from 'next/dynamic';
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Box, ShieldCheck, Activity as ActivityIcon, BadgePercent, BarChart as BarChartIcon, KeyRound, Map, UserPlus, Users, PieChart as PieChartIcon, Globe, ArrowUpRight, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
import type { ValidationLog, DailyValidationData, License, DailyNewUsersData, NewLicenseDistributionData, Settings, BotStatus, DashboardStats } from "@/lib/types";
import { DiscordStatusWidget } from "@/components/dashboard/DiscordStatusWidget";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const ValidationChart = dynamic(() => import('@/components/dashboard/ValidationChart').then(mod => mod.ValidationChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[250px] w-full" />,
});

const NewUsersChart = dynamic(() => import('@/components/dashboard/NewUsersChart').then(mod => mod.NewUsersChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[120px] w-full" />,
});

const NewLicensesChart = dynamic(() => import('@/components/dashboard/NewLicensesChart').then(mod => mod.NewLicensesChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[120px] w-full" />,
});

const InteractiveMap = dynamic(() => import('@/components/dashboard/InteractiveMap').then(mod => mod.InteractiveMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full" />,
});


type ActivityItem = (
  | { type: 'validation'; data: ValidationLog }
  | { type: 'license'; data: License }
) & { timestamp: Date };


function processLogsForChart(logs: ValidationLog[]): DailyValidationData[] {
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = startOfDay(subDays(new Date(), i));
    return {
      date: format(date, "MMM d"),
      success: 0,
      failure: 0,
    };
  }).reverse();

  const sevenDaysAgo = startOfDay(subDays(new Date(), 6));

  logs.forEach(log => {
    const logDate = new Date(log.timestamp);
    if (logDate >= sevenDaysAgo) {
      const formattedDate = format(startOfDay(logDate), "MMM d");
      const dayData = last7Days.find(d => d.date === formattedDate);
      if (dayData) {
        if (log.status === 'success') {
          dayData.success++;
        } else {
          dayData.failure++;
        }
      }
    }
  });

  return last7Days;
}

interface DashboardClientProps {
  stats: DashboardStats;
  allLogs: ValidationLog[];
  allLicenses: License[];
  settings: Settings;
  botStatus: BotStatus;
}

export function DashboardClient({ stats, allLogs, allLicenses, settings, botStatus }: DashboardClientProps) {

  const chartData = processLogsForChart(allLogs);

  const validationSuccessRate = stats.totalValidations > 0
    ? ((stats.successfulValidations / stats.totalValidations) * 100).toFixed(0)
    : 0;

  const combinedActivity: ActivityItem[] = [
    ...allLogs.map(log => ({ type: 'validation' as const, data: log, timestamp: new Date(log.timestamp) })),
    ...allLicenses.map(license => ({ type: 'license' as const, data: license, timestamp: new Date(license.createdAt) }))
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  .slice(0, 5);


  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="An overview of your license management system."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Box}
          color="bg-sky-500"
        />
        <StatCard
          title="Total Licenses"
          value={stats.totalLicenses}
          icon={KeyRound}
          description={`${stats.activeLicenses} active`}
          color="bg-orange-500"
        />
        <StatCard
          title="Total Validations"
          value={stats.totalValidations}
          icon={ActivityIcon}
          description={
            <div className="flex items-center gap-1 text-green-500">
                <ArrowUpRight className="h-4 w-4" />
                {stats.validationChangePercent.toFixed(1)}% this week
            </div>
          }
           color="bg-indigo-500"
        />
        <StatCard
          title="Success Rate"
          value={`${validationSuccessRate}%`}
          icon={BadgePercent}
          description={`${stats.successfulValidations} successful validations`}
           color="bg-green-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Users className="h-6 w-6"/>
                    <div>
                        <CardTitle>New Users</CardTitle>
                        <CardDescription>Last 7 days</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <NewUsersChart data={stats.dailyNewUsers} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                 <div className="flex items-center gap-3">
                    <PieChartIcon className="h-6 w-6"/>
                    <div>
                        <CardTitle>New License Distribution</CardTitle>
                        <CardDescription>Last 7 days</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <NewLicensesChart data={stats.newLicenseDistribution} />
            </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex flex-col flex-1">
                <Card className="flex-1 flex flex-col">
                    <CardHeader>
                        <CardTitle>Validation Activity</CardTitle>
                        <CardDescription>Successful and failed validations over the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <ValidationChart data={chartData} />
                    </CardContent>
                </Card>
            </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
           {settings.discordBot.enabled && (
             <DiscordStatusWidget initialStatus={botStatus} />
           )}
           <Card className="h-fit">
                <CardHeader>
                    <div className="flex items-center gap-3">
                    <ActivityIcon className="h-6 w-6" />
                    <div>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>A feed of recent events.</CardDescription>
                    </div>
                    </div>
                </CardHeader>
                <CardContent className="min-h-[400px]">
                     <div className="relative pl-6">
                      {combinedActivity.length > 0 ? (
                        combinedActivity.map((item, index) => {
                          const isLast = index === combinedActivity.length - 1;
                          return (
                            <div key={item.data.id} className={cn("flex gap-x-3", !isLast && "pb-8")}>
                               <div className="relative">
                                {!isLast && <div className="absolute left-2.5 top-5 h-full w-px bg-border" />}
                                <div className={cn("relative flex h-5 w-5 items-center justify-center rounded-full",
                                  item.type === 'validation' && item.data.status === 'success' && 'bg-green-500/20 text-green-500',
                                  item.type === 'validation' && item.data.status === 'failure' && 'bg-red-500/20 text-red-500',
                                  item.type === 'license' && 'bg-blue-500/20 text-blue-500'
                                )}>
                                  {item.type === 'validation' ? (
                                    <BarChartIcon className="h-3 w-3" />
                                  ) : (
                                    <KeyRound className="h-3 w-3" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 text-sm pt-0.5">
                                {item.type === 'validation' ? (
                                  <p className="text-muted-foreground">
                                    <Badge variant={item.data.status === 'success' ? "success" : "destructive"} className="mr-1">{item.data.status}</Badge> 
                                    validation on{' '}
                                    <span className="font-medium text-foreground">{item.data.productName}</span>
                                    {item.data.location && ` from ${item.data.location.city}, ${item.data.location.country}`}.
                                  </p>
                                ) : (
                                  <p className="text-muted-foreground">
                                    <Badge variant="outline" className="mr-1">New License</Badge> 
                                    created for{' '}
                                    <span className="font-medium text-foreground">{item.data.discordUsername || item.data.discordId}</span>.
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-muted-foreground">{format(item.timestamp, "MMM d, HH:mm")}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex h-24 items-center justify-center">
                          <p className="text-sm text-muted-foreground">No activity yet.</p>
                        </div>
                      )}
                    </div>
                </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-3">
             <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Map className="h-6 w-6" />
                        <div>
                            <CardTitle>Validation Locations</CardTitle>
                            <CardDescription>A world map showing recent validation request locations.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex h-[500px] flex-col gap-6 p-2 pt-0 sm:flex-row sm:p-4 sm:pt-0">
                    <div className="flex-[3] h-full w-full">
                       <InteractiveMap logs={allLogs} />
                    </div>
                    <div className="flex-[1] flex h-full flex-col">
                        <h4 className="mb-4 text-sm font-semibold text-muted-foreground px-2">Recent Access</h4>
                        <ScrollArea className="flex-1">
                             <div className="space-y-4 pr-2">
                                {allLogs.slice(0, 10).map(log => (
                                <div key={log.id} className="flex items-start gap-4">
                                    <div className="flex-1 space-y-1">
                                    <p className="font-mono text-xs leading-none">
                                        {log.licenseKey.substring(0, 15)}...
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {log.ipAddress} from {log.location?.city || "Unknown"}
                                    </p>
                                    </div>
                                    <div className="ml-auto text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                    </div>
                                </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
