
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { updateSettings, generateNewApiKey } from "@/lib/actions";
import type { Settings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { useRouter } from "next/navigation";
import { CodeBlock } from "@/components/integration/CodeBlock";
import { CopyButton } from "../CopyButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";

const settingsSchema = z.object({
  enabled: z.boolean(),
  secret: z.string().optional(),
  disableIpProtection: z.boolean(),
  maxIps: z.coerce.number().min(0).default(1),
  enableHwidProtection: z.boolean(),
  maxHwids: z.coerce.number().min(0).default(1),
});

export function BuiltByBitPlaceholderClient({ settings }: { settings: Settings }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const webhookUrl = settings.panelUrl ? `${settings.panelUrl}/api/webhooks/builtbybit/placeholder` : 'https://<YOUR_APP_URL>/api/webhooks/builtbybit/placeholder';

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      enabled: settings.builtByBitPlaceholder.enabled || false,
      secret: settings.builtByBitPlaceholder.secret || "",
      disableIpProtection: settings.builtByBitPlaceholder.disableIpProtection || false,
      maxIps: settings.builtByBitPlaceholder.maxIps || 1,
      enableHwidProtection: settings.builtByBitPlaceholder.enableHwidProtection || false,
      maxHwids: settings.builtByBitPlaceholder.maxHwids || 1,
    },
  });

  const watchDisableIpProtection = form.watch("disableIpProtection");
  const watchEnableHwidProtection = form.watch("enableHwidProtection");

  const handleSettingsUpdate = (data: z.infer<typeof settingsSchema>) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('builtByBitPlaceholder.enabled', data.enabled ? 'on' : 'off');
      formData.append('builtByBitPlaceholder.secret', data.secret || '');
      formData.append('builtByBitPlaceholder.disableIpProtection', data.disableIpProtection ? 'on' : 'off');
      formData.append('builtByBitPlaceholder.maxIps', String(data.maxIps));
      formData.append('builtByBitPlaceholder.enableHwidProtection', data.enableHwidProtection ? 'on' : 'off');
      formData.append('builtByBitPlaceholder.maxHwids', String(data.maxHwids));
      
      if (data.enabled) {
        formData.append('builtByBitWebhookSecret.enabled', 'off');
      }

      const result = await updateSettings(formData);

      if (result.success) {
        toast({ title: "Success", description: "BuiltByBit placeholder settings have been updated." });
        router.refresh();
      } else {
        toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
      }
    });
  };

  const step3Code = `
const licenseKey = "%%__PRODUCT_LICENSE__%%"; // This is replaced by BuiltByBit

const response = await fetch("${webhookUrl.replace('/webhooks/builtbybit/placeholder', '/api/validate')}", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        key: licenseKey,
    }),
});

const data = await response.json();

if (data.success) {
    console.log("License is valid!");
} else {
    console.error("Validation failed:", data.message);
    // Terminate your application
}
  `.trim();

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSettingsUpdate)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Placeholder Automation Settings</CardTitle>
              <CardDescription>
                Configure the default restrictions and security for licenses generated via the placeholder automation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Placeholder Automation</FormLabel>
                      <FormDescription>
                        Enabling this will disable the Purchase Webhook automation.
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <FormField
                control={form.control}
                name="secret"
                render={({ field }) => (
                  <FormItem className="pt-6">
                    <FormLabel>Placeholder Secret Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your shared secret"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This secret must match the secret key you provide to BuiltByBit.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <h3 className="font-semibold">Step 1. Webhook URL</h3>
            <p className="text-sm text-muted-foreground">
              Copy this URL. You will use it when creating the placeholder in BuiltByBit.
            </p>
            <div className="flex gap-2 items-center rounded-md bg-muted p-3 text-sm font-mono whitespace-pre-wrap break-all">
                <span className="flex-1">{webhookUrl}</span>
                <CopyButton textToCopy={webhookUrl} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Step 2. Create Placeholder</h3>
            <p className="text-sm text-muted-foreground">
              In BuiltByBit, go to "Placeholders" and create a new one with the following settings:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>**Name:** Use a descriptive name like `%%__PRODUCT_LICENSE__%%`.</li>
                <li>**Type:** Set to `External License Key`.</li>
                <li>**Webhook URL:** Paste the URL you copied above.</li>
                <li>**Secret Key:** Paste the secret key you configured in the settings above.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Step 3. Use the placeholder in your product</h3>
            <p className="text-sm text-muted-foreground">
              When calling your panel's validation API, pass the placeholder string as the `key`. BuiltByBit will substitute it at download time.
            </p>
            <CodeBlock language="javascript" code={step3Code} />
          </div>
           <div className="space-y-2">
            <h3 className="font-semibold">Step 4. Automatic licence assignment</h3>
            <p className="text-sm text-muted-foreground">
              When a user downloads your product, BuiltByBit will call your webhook. A lifetime license will be automatically generated and assigned to their BuiltByBit user ID, and the placeholder will be replaced with the real key. The user can then link their Discord account using the `/link-builtbybit` command.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
