"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Trash2, ShieldAlert, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addToBlacklist, removeFromBlacklist, unblacklistUser } from "@/lib/actions";
import type { Blacklist, ValidationLog, BlacklistedUser } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "../ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";

const blacklistSchema = z.object({
  type: z.enum(["ip", "hwid", "discordId"], { required_error: "Type is required." }),
  value: z.string().min(1, "Value cannot be empty."),
});

interface BlacklistClientProps {
  blacklist: Blacklist;
  logs: ValidationLog[];
  blacklistedUsers: BlacklistedUser[];
}

export function BlacklistClient({
  blacklist,
  logs,
  blacklistedUsers,
}: BlacklistClientProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof blacklistSchema>>({
    resolver: zodResolver(blacklistSchema),
    defaultValues: {
      type: "ip",
      value: "",
    },
  });

  async function onSubmit(values: z.infer<typeof blacklistSchema>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("type", values.type);
      formData.append("value", values.value);
      const result = await addToBlacklist(formData);

      if (result.success) {
        toast({
          title: "Success",
          description: `The ${values.type.toUpperCase()} has been added to the blacklist.`,
        });
        form.reset();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update blacklist.",
        });
      }
    });
  }

  const handleRemove = (type: "ip" | "hwid", value: string) => {
    startTransition(async () => {
      await removeFromBlacklist(type, value);
      toast({
        title: "Success",
        description: `The ${type.toUpperCase()} has been removed from the blacklist.`,
      });
    });
  };

  const handleUnblacklistUser = (userId: string) => {
    startTransition(async () => {
      const result = await unblacklistUser(userId);
       if (result.success) {
        toast({
          title: "Success",
          description: `User has been unblacklisted. Associated IPs/HWIDs may have been removed.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message || "Failed to unblacklist user.",
        });
      }
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Add to Blacklist</CardTitle>
            <CardDescription>
              Add a new IP address, HWID, or Discord ID to the blacklist.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="w-1/3">
                        <FormLabel>Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ip">IP Address</SelectItem>
                            <SelectItem value="hwid">HWID</SelectItem>
                            <SelectItem value="discordId">Discord ID</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 192.168.1.1 or a-hwid-string" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <CardFooter>
                 <Button type="submit" disabled={isPending}>
                  <PlusCircle className="mr-2" />
                  {isPending ? "Adding..." : "Add to Blacklist"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Blacklisted Users</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {blacklistedUsers.length > 0 ? (
                        blacklistedUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3">
                                   <Avatar className="h-8 w-8">
                                     <AvatarImage src={user.avatarUrl} alt={user.username} />
                                     <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                   </Avatar>
                                   <div>
                                       <span>{user.username}</span>
                                       <p className="text-xs text-muted-foreground font-mono">{user.id}</p>
                                   </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleUnblacklistUser(user.id)} disabled={isPending}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No users are currently blacklisted.</p>
                    )}
                </div>
            </CardContent>
        </Card>
        <div className="grid gap-8 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Blacklisted IPs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {blacklist.ips.length > 0 ? (
                            blacklist.ips.map((ip) => (
                                <div key={ip} className="flex items-center justify-between text-sm">
                                    <span className="font-mono">{ip}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemove('ip', ip)} disabled={isPending}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No IPs blacklisted.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Blacklisted HWIDs</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="space-y-2">
                        {blacklist.hwids.length > 0 ? (
                            blacklist.hwids.map((hwid) => (
                                <div key={hwid} className="flex items-center justify-between text-sm">
                                    <span className="font-mono">{hwid}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemove('hwid', hwid)} disabled={isPending}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No HWIDs blacklisted.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
            <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-destructive" />
                <div>
                    <CardTitle>Blacklisted Access Attempts</CardTitle>
                    <CardDescription>
                        A log of validation attempts from blacklisted identifiers.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.reason === 'Blacklisted IP' ? log.ipAddress : (log.hwid || 'N/A')}
                    </TableCell>
                    <TableCell>
                       <Badge variant="destructive">
                        {log.reason === 'Blacklisted IP' ? 'IP' : 
                         log.reason === 'Blacklisted HWID' ? 'HWID' : 
                         log.reason === 'User blacklisted' ? 'User' : 'Unknown'}
                       </Badge>
                    </TableCell>
                    <TableCell>{log.reason}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No blacklisted access attempts recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
