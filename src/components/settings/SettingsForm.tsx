
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition, useEffect, useRef } from "react";
import { Copy, RefreshCw, Save, Terminal } from "lucide-react";
import { updateSettings, generateNewApiKey } from "@/lib/actions";
import type { Settings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CodeBlock } from "../integration/CodeBlock";
import { CopyButton } from "../CopyButton";

const settingsSchema = z.object({
  panelUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  adminApiEnabled: z.boolean().default(false),
  discordBot: z.object({
      enabled: z.boolean().default(false)
  }),
  clientPanel: z.object({
    enabled: z.boolean().default(false),
    accentColor: z.string().optional(),
  }),
  adminApiEndpoints: z.object({
    getLicenses: z.boolean().default(true),
    createLicense: z.boolean().default(true),
    updateLicense: z.boolean().default(true),
    deleteLicense: z.boolean().default(true),
    updateIdentities: z.boolean().default(true),
    renewLicense: z.boolean().default(true),
    addSubUser: z.boolean().default(true),
    removeSubUser: z.boolean().default(true),
  }),
  logging: z.object({
    enabled: z.boolean().default(false),
    webhookUrl: z.string().url("Must be a valid Discord webhook URL").optional().or(z.literal('')),
    logLicenseCreations: z.boolean().default(true),
    logLicenseUpdates: z.boolean().default(true),
    logBotCommands: z.boolean().default(true),
    logBlacklistActions: z.boolean().default(true),
    logBuiltByBit: z.boolean().default(true),
  })
});

type EndpointKey = keyof typeof settingsSchema.shape.adminApiEndpoints.shape;

const endpointDetails: Record<EndpointKey, { label: string; description: string; method: string; path: string; body?: object; response: object; }> = {
  getLicenses: { 
    label: "Get All Licenses", 
    description: "Fetches a comprehensive list of all licenses, with product names populated.", 
    method: "GET", 
    path: "/api/admin/licenses",
    response: [{ "id": "...", "key": "LF-...", "productId": "...", "productName": "My Product", "discordId": "...", "status": "active", "...": "..." }]
  },
  createLicense: { 
    label: "Create License", 
    description: "Creates a new license with specified parameters. 'productId' and 'discordId' are required.", 
    method: "POST", 
    path: "/api/admin/licenses", 
    body: { productId: "prod_...", discordId: "123456789", expiresAt: "2025-12-31T23:59:59Z", maxIps: 1, maxHwids: 1 },
    response: { "id": "...", "key": "LF-...", "productId": "...", "discordId": "...", "status": "active", "...": "..." }
  },
  updateLicense: { 
    label: "Update License Status", 
    description: "Activates or deactivates a specific license key.", 
    method: "PATCH", 
    path: "/api/admin/licenses/{key}", 
    body: { status: "inactive" },
    response: { "id": "...", "key": "LF-...", "status": "inactive", "...": "..." }
  },
  deleteLicense: { 
    label: "Delete License", 
    description: "Permanently deletes a license from the system.", 
    method: "DELETE", 
    path: "/api/admin/licenses/{key}",
    response: { "status": 204, "message": "No Content" }
  },
  updateIdentities: { 
    label: "Add License IP/HWID", 
    description: "Adds a new IP address or HWID to a license's list of allowed identifiers.", 
    method: "PATCH", 
    path: "/api/admin/licenses/{key}/identities", 
    body: { ip: "1.2.3.4" },
    response: { "id": "...", "key": "LF-...", "allowedIps": ["1.2.3.4"], "...": "..." }
  },
  renewLicense: { 
    label: "Renew License", 
    description: "Sets a new expiration date for a license and reactivates it if expired.", 
    method: "PATCH", 
    path: "/api/admin/licenses/{key}/renew", 
    body: { expiresAt: "2026-12-31T23:59:59Z" },
    response: { "id": "...", "key": "LF-...", "expiresAt": "2026-12-31T23:59:59Z", "status": "active", "...": "..." }
  },
  addSubUser: {
    label: "Add Sub-user",
    description: "Adds a sub-user to a license, allowing them to validate the key.",
    method: "POST",
    path: "/api/admin/licenses/{key}/sub-users",
    body: { subUserDiscordId: "987654321" },
    response: { "id": "...", "key": "LF-...", "subUserDiscordIds": ["...", "987654321"], "...": "..." }
  },
  removeSubUser: {
    label: "Remove Sub-user",
    description: "Removes a sub-user from a license.",
    method: "DELETE",
    path: "/api/admin/licenses/{key}/sub-users",
    body: { subUserDiscordId: "987654321" },
    response: { "id": "...", "key": "LF-...", "subUserDiscordIds": ["..."], "...": "..." }
  }
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const { toast } = useToast();
  const router = useRouter();
  const [currentApiKey, setCurrentApiKey] = useState(settings.apiKey);
  const [isPending, startTransition] = useTransition();
  const [isOauthDialogOpen, setOauthDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings ? {
      panelUrl: settings.panelUrl || "",
      adminApiEnabled: settings.adminApiEnabled,
      discordBot: {
          enabled: settings.discordBot.enabled
      },
      clientPanel: {
        enabled: settings.clientPanel?.enabled || false,
        accentColor: settings.clientPanel?.accentColor || '#3b82f6',
      },
      adminApiEndpoints: {
        ...settings.adminApiEndpoints,
        addSubUser: settings.adminApiEndpoints.manageTeam, // migrate old value
        removeSubUser: settings.adminApiEndpoints.manageTeam,
      },
      logging: settings.logging
    } : undefined
  });

  const initialValuesRef = useRef(JSON.stringify(form.getValues()));

  const debouncedSettingsUpdate = useDebouncedCallback(async (values: z.infer<typeof settingsSchema>) => {
    startTransition(async () => {
      const result = await updateSettings(values);
      if (result.success) {
        toast({
          title: "Settings Auto-Saved",
          description: "Your changes have been saved successfully.",
        });
        initialValuesRef.current = JSON.stringify(values);
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to save settings.",
          variant: "destructive",
        });
      }
    });
  }, 1000);


  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      const currentValues = JSON.stringify(value);
      if (currentValues !== initialValuesRef.current) {
        if (name === "clientPanel.enabled" && value.clientPanel?.enabled) {
          setOauthDialogOpen(true);
        }
        debouncedSettingsUpdate(value as z.infer<typeof settingsSchema>);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, debouncedSettingsUpdate]);


  const handleGenerateKey = () => {
    startTransition(async () => {
      const result = await generateNewApiKey();
      if (result.success && result.newKey) {
        setCurrentApiKey(result.newKey);
        toast({
          title: "API Key Generated",
          description: "A new API key has been generated and saved.",
        });
      }
    });
  };

  const copyToClipboard = () => {
    if (!currentApiKey) return;
    navigator.clipboard.writeText(currentApiKey);
    toast({ title: "Copied!", description: "API Key copied to clipboard." });
  };

  const redirectUrl = `${form.watch('panelUrl') || '<PANEL_URL>'}/api/auth/discord/callback`;
  
  return (
    <>
    <Form {...form}>
      <form className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-8">
            <Card>
              <CardHeader>
                <CardTitle>API Settings</CardTitle>
                <CardDescription>
                  Manage your application settings and API keys. Changes to toggles are auto-saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-2 rounded-lg border p-4">
                  <FormField
                    control={form.control}
                    name="adminApiEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Admin API</FormLabel>
                          <FormDescription>
                            Allow global access to all enabled admin API endpoints.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="panelUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://yourapp.com"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        The public URL of your application for integration snippets.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Admin API Key</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        value={currentApiKey}
                        readOnly
                        placeholder="Generate a key to get started"
                        className="font-mono"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyToClipboard}
                      disabled={!currentApiKey}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormDescription>
                    Use this key in the 'x-api-key' header for admin requests. Keep it secure.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Generate a new key if it's compromised.
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isPending}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generate New Key
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will invalidate your current API key. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGenerateKey} disabled={isPending}>
                          {isPending ? "Generating..." : "Confirm"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>

             <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>
                  Enable or disable integrations. Changes are auto-saved.
                </CardDescription>
              </CardHeader>
               <CardContent className="space-y-4">
                    <div className="space-y-2 rounded-lg border p-4">
                        <FormField
                        control={form.control}
                        name="clientPanel.enabled"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Enable Client Panel</FormLabel>
                                <FormDescription>
                                Globally enables or disables the client-facing dashboard.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isPending}
                                />
                            </FormControl>
                            </FormItem>
                        )}
                        />
                         {form.watch('clientPanel.enabled') && (
                            <div className="pt-4">
                                <FormField
                                control={form.control}
                                name="clientPanel.accentColor"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Client Panel Accent Color</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                        <Input
                                            type="color"
                                            className="h-10 w-12 p-1"
                                            {...field}
                                            value={field.value ?? "#3b82f6"}
                                        />
                                        <Input
                                            placeholder="#3b82f6"
                                            className="flex-1"
                                            {...field}
                                            value={field.value ?? "#3b82f6"}
                                        />
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        Set the primary accent color for the client panel UI.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                           </div>
                         )}
                  </div>
                  <div className="space-y-2 rounded-lg border p-4">
                    <FormField
                      control={form.control}
                      name="discordBot.enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Discord Bot</FormLabel>
                            <FormDescription>
                              Globally enables or disables the bot. Requires a restart.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-2 rounded-lg border p-4 mt-4">
                     <FormField
                      control={form.control}
                      name="logging.enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Discord Webhook Logging</FormLabel>
                            <FormDescription>
                              Log important events to a Discord channel.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {form.watch('logging.enabled') && (
                        <div className="space-y-4 pt-4">
                             <FormField
                              control={form.control}
                              name="logging.webhookUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Webhook URL</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="https://discord.com/api/webhooks/..."
                                      {...field}
                                      value={field.value ?? ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="logging.logLicenseCreations"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal">License Events</FormLabel>
                                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="logging.logBotCommands"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal">Bot Commands</FormLabel>
                                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="logging.logBlacklistActions"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal">Blacklist Actions</FormLabel>
                                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="logging.logBuiltByBit"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                                      <FormLabel className="text-sm font-normal">BuiltByBit Events</FormLabel>
                                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                  )}
                                />
                            </div>
                        </div>
                    )}
                  </div>
              </CardContent>
            </Card>

          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Admin API Endpoint Documentation</CardTitle>
                <CardDescription>
                  Enable, disable, and review all available Admin API endpoints.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="multiple" className="w-full space-y-2">
                  {(Object.keys(endpointDetails) as EndpointKey[]).map((key) => {
                    const details = endpointDetails[key];
                    return (
                      <AccordionItem value={key} key={key} className="border-b-0 rounded-lg border data-[state=open]:bg-accent/30">
                        <div className="flex items-center px-4">
                          <FormField
                            key={key}
                            control={form.control}
                            name={`adminApiEndpoints.${key}`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center py-2 mr-4">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isPending || !form.getValues().adminApiEnabled}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <AccordionTrigger className="py-2 hover:no-underline flex-1">
                            <div className="flex flex-col items-start text-left">
                              <p className="font-semibold">{details.label}</p>
                              <div className="flex items-center gap-2">
                                <span className={cn("font-mono text-xs font-semibold", 
                                    details.method === "GET" && "text-blue-500",
                                    details.method === "POST" && "text-green-500",
                                    details.method === "PATCH" && "text-orange-500",
                                    details.method === "DELETE" && "text-red-500"
                                )}>{details.method}</span>
                                <span className="font-mono text-sm text-muted-foreground">{details.path}</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent>
                          <div className="space-y-4 px-4 pb-4">
                            <p className="text-sm text-muted-foreground">{details.description}</p>
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold">Headers</h4>
                              <CodeBlock language="json" code={JSON.stringify({ "x-api-key": "YOUR_ADMIN_API_KEY" }, null, 2)} />
                            </div>
                            {details.body && (
                              <div className="space-y-1">
                                <h4 className="text-sm font-semibold">Example Request Body</h4>
                                 <CodeBlock language="json" code={JSON.stringify(details.body, null, 2)} />
                              </div>
                            )}
                             <div className="space-y-1">
                                <h4 className="text-sm font-semibold">Example Success Response</h4>
                                 <CodeBlock language="json" code={JSON.stringify(details.response, null, 2)} />
                              </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="flex justify-end pt-4">
            <Button 
                type="button" 
                disabled={isPending}
                onClick={() => debouncedSettingsUpdate.flush()}
            >
               <Save className="mr-2"/>
               Save Non-Toggle Fields
            </Button>
        </div>
      </form>
    </Form>
     <AlertDialog open={isOauthDialogOpen} onOpenChange={setOauthDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Action Required</AlertDialogTitle>
            <AlertDialogDescription>
                To enable the client panel, you must add a Redirect URI to your Discord Application's OAuth2 settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Copy the URL below and paste it into the "Redirects" section on the OAuth2 page of your Discord Developer Portal.</p>
                <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                    <pre className="flex-1 font-mono text-xs overflow-x-auto custom-scrollbar">{redirectUrl}</pre>
                    <CopyButton textToCopy={redirectUrl} />
                </div>
            </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setOauthDialogOpen(false)}>I understand</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
