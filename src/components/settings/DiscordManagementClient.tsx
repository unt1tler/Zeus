

"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { Trash2, PlusCircle, Save, Check, X } from "lucide-react";
import { updateSettings } from "@/lib/actions";
import type { DiscordBotSettings, DiscordCommands } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

const settingsSchema = z.object({
  adminIds: z.array(z.object({ value: z.string().min(1, "Admin ID cannot be empty.") })),
  commands: z.object({
    viewUser: z.boolean(),
    checkLicenses: z.boolean(),
    searchLicense: z.boolean(),
    deactivate: z.boolean(),
    createLicense: z.boolean(),
    renewLicense: z.boolean(),
    profile: z.boolean(),
    userLicenses: z.boolean(),
    manageLicense: z.boolean(),
    redeem: z.boolean(),
    linkBuiltbybit: z.boolean(),
  }),
});

type CommandKey = keyof DiscordCommands;

const commandDetails: Record<CommandKey, { label: string, description: string, admin: boolean }> = {
    viewUser: { label: "/view-user", description: "View a user's licenses and details.", admin: true },
    checkLicenses: { label: "/check-licenses", description: "Check details of a specific license key.", admin: true },
    searchLicense: { label: "/search-license", description: "Search for licenses by Discord ID.", admin: true },
    deactivate: { label: "/deactivate", description: "Deactivate a license key.", admin: true },
    createLicense: { label: "/create-license", description: "Create a new license key.", admin: true },
    renewLicense: { label: "/renew-license", description: "Renew an expired license.", admin: true },
    profile: { label: "/profile", description: "View your own license profile.", admin: false },
    userLicenses: { label: "/user-licenses", description: "View all licenses you own or are a sub-user on.", admin: false },
    manageLicense: { label: "/manage-license", description: "Manage your license (e.g., add/remove sub-users).", admin: false },
    redeem: { label: "/redeem", description: "Redeem a voucher code for a license.", admin: false },
    linkBuiltbybit: { label: "/link-builtbybit", description: "Link a BuiltByBit account to your Discord.", admin: false },
};

export function DiscordManagementClient({ initialSettings }: { initialSettings: DiscordBotSettings }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      adminIds: initialSettings.adminIds.map(id => ({ value: id })),
      commands: {
        ...initialSettings.commands,
        linkBuiltbybit: initialSettings.commands.linkBuiltbybit ?? false,
      }
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "adminIds",
  });

  const handleSettingsUpdate = (data: z.infer<typeof settingsSchema>) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('discordBot.adminIds', JSON.stringify(data.adminIds.map(id => id.value)));
      Object.entries(data.commands).forEach(([key, value]) => {
          formData.append(`discordBot.commands.${key}`, value ? 'on' : 'off');
      });

      const result = await updateSettings(formData);

      if (result.success) {
        toast({ title: "Success", description: "Discord bot settings have been saved. Restart the bot to apply command changes." });
        router.refresh();
      } else {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    });
  };

  const toggleAllCommands = (enable: boolean) => {
    const currentCommands = form.getValues('commands');
    for (const key in currentCommands) {
        form.setValue(`commands.${key as CommandKey}`, enable);
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSettingsUpdate)} className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Bot Admins</CardTitle>
                <CardDescription>Discord User IDs of bot administrators.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                    <FormField
                        control={form.control}
                        name={`adminIds.${index}.value`}
                        render={({ field }) => (
                        <FormItem className="flex-1">
                            <FormControl><Input placeholder="Enter a Discord User ID" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 /></Button>
                    </div>
                ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ value: "" })}>
                    <PlusCircle className="mr-2" /> Add Admin
                </Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Command Toggles</CardTitle>
                <CardDescription>Enable or disable specific bot commands. The bot must be restarted to apply changes.</CardDescription>
                <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleAllCommands(true)}>
                        <Check className="mr-2" /> Enable All
                    </Button>
                     <Button type="button" variant="outline" size="sm" onClick={() => toggleAllCommands(false)}>
                        <X className="mr-2" /> Disable All
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 {(Object.keys(commandDetails) as CommandKey[]).map((key) => (
                     <FormField
                        key={key}
                        control={form.control}
                        name={`commands.${key}`}
                        render={({ field }) => (
                             <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>{commandDetails[key].label}</FormLabel>
                                    <FormDescription>{commandDetails[key].description}</FormDescription>
                                </div>
                            </FormItem>
                        )}
                    />
                 ))}
            </CardContent>
        </Card>
         <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
               <Save className="mr-2"/>
               {isPending ? 'Saving...' : 'Save All Settings'}
            </Button>
        </div>
      </form>
    </Form>
  )
}
