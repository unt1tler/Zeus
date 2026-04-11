
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { updateSettings } from "@/lib/actions";
import type { Settings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { CodeBlock } from "@/components/integration/CodeBlock";
import { CopyButton } from "../CopyButton";
import { Switch } from "../ui/switch";

const settingsSchema = z.object({
  enabled: z.boolean(),
  secret: z.string().optional(),
  disableIpProtection: z.boolean(),
  maxIps: z.coerce.number().min(0).default(1),
  enableHwidProtection: z.boolean(),
  maxHwids: z.coerce.number().min(0).default(1),
});

export function BuiltByBitWebhookClient({ settings }: { settings: Settings }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const webhookUrl = settings.panelUrl ? `${settings.panelUrl}/api/webhooks/builtbybit` : 'https://<YOUR_APP_URL>/api/webhooks/builtbybit';

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      enabled: settings.builtByBitWebhookSecret?.enabled || false,
      secret: settings.builtByBitWebhookSecret?.secret || "",
      disableIpProtection: settings.builtByBitWebhookSecret?.disableIpProtection || false,
      maxIps: settings.builtByBitWebhookSecret?.maxIps || 1,
      enableHwidProtection: settings.builtByBitWebhookSecret?.enableHwidProtection || false,
      maxHwids: settings.builtByBitWebhookSecret?.maxHwids || 1,
    },
  });

  const watchDisableIpProtection = form.watch("disableIpProtection");
  const watchEnableHwidProtection = form.watch("enableHwidProtection");

  const handleSettingsUpdate = (data: z.infer<typeof settingsSchema>) => {
    startTransition(async () => {
      const result = await updateSettings({
        builtByBitWebhookSecret: data,
        ...(data.enabled ? { builtByBitPlaceholder: { enabled: false } } : {}),
      });

      if (result.success) {
        toast({ title: "Success", description: "BuiltByBit webhook settings have been updated." });
        router.refresh();
      } else {
        toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSettingsUpdate)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure the shared secret and default settings for licenses created via this webhook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Purchase Webhook</FormLabel>
                      <FormDescription>
                        Enabling this will disable the Placeholder Automation.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your shared secret"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This secret must match the 'secret' key you configure in your BuiltByBit webhook body.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="disableIpProtection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Disable IP Protection</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxIps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max IPs</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} disabled={watchDisableIpProtection} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enableHwidProtection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enable HWID Protection</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxHwids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max HWIDs</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} disabled={!watchEnableHwidProtection} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
             <CardFooter>
               <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Settings"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">1. Webhook URL</h3>
            <p className="text-sm text-muted-foreground">
              In your BuiltByBit developer panel, create a new webhook and set the URL to:
            </p>
            <div className="flex gap-2 items-center rounded-md bg-muted p-3 text-sm font-mono whitespace-pre-wrap break-all">
                <span className="flex-1">{webhookUrl}</span>
                <CopyButton textToCopy={webhookUrl} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">2. Webhook Triggers</h3>
            <p className="text-sm text-muted-foreground">
              Set the webhook template to "JSON passthrough" and trigger on **"Purchase of any resource"**.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">3. Request Body (JSON)</h3>
            <p className="text-sm text-muted-foreground">
              Include the `secret` in the request body along with the purchase placeholders. JSON passthrough is the recommended BuiltByBit setup for this endpoint, and `purchase_date` should be included so retries can be deduplicated safely.
            </p>
             <CodeBlock language="json" code={JSON.stringify({
              "secret": "YOUR_SHARED_SECRET_HERE",
              "user_id": "{user_id}",
              "resource_id": "{resource_id}",
              "resource_title": "{resource_title}",
              "purchase_date": "{purchase_date}"
            }, null, 2)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
