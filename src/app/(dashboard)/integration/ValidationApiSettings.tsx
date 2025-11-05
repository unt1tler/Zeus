
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useEffect, useRef } from "react";
import { updateSettings } from "@/lib/actions";
import type { Settings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
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
import { CodeBlock } from "@/components/integration/CodeBlock";
import { useDebouncedCallback } from "use-debounce";

const validationResponseSchema = z.object({
    requireDiscordId: z.boolean().default(false),
    customSuccessMessage: z.object({
      enabled: z.boolean().default(false),
      message: z.string().optional(),
    }),
    license: z.object({
      enabled: z.boolean().default(false),
      fields: z.object({
        license_key: z.boolean().default(false),
        status: z.boolean().default(false),
        expires_at: z.boolean().default(false),
        issue_date: z.boolean().default(false),
        max_ips: z.boolean().default(false),
        used_ips: z.boolean().default(false),
      }),
    }),
    customer: z.object({
      enabled: z.boolean().default(false),
      fields: z.object({
        id: z.boolean().default(false),
        discord_id: z.boolean().default(false),
        customer_since: z.boolean().default(false),
      }),
    }),
    product: z.object({
      enabled: z.boolean().default(false),
      fields: z.object({
        id: z.boolean().default(false),
        name: z.boolean().default(false),
        enabled: z.boolean().default(false),
      }),
    }),
  }).superRefine((data, ctx) => {
    if (data.customSuccessMessage.enabled && (!data.customSuccessMessage.message || data.customSuccessMessage.message.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customSuccessMessage.message"],
        message: "Message is required when custom success message is enabled.",
      });
    }
});


const settingsSchema = z.object({
  validationResponse: validationResponseSchema
});

const validationResponseFieldDetails = {
    license: {
        label: 'Include License Info',
        description: 'Returns the license object.',
        fields: {
            license_key: 'License Key',
            status: 'Status',
            expires_at: 'Expiration Date',
            issue_date: 'Issue Date',
            max_ips: 'Max IPs',
            used_ips: 'Used IPs'
        }
    },
    customer: {
        label: 'Include Customer Info',
        description: 'Returns the customer object.',
        fields: {
            id: 'Unique ID',
            discord_id: 'Discord ID',
            customer_since: 'Customer Since Date'
        }
    },
    product: {
        label: 'Include Product Info',
        description: 'Returns the product object.',
        fields: {
            id: 'Product ID',
            name: 'Product Name',
            enabled: 'Enabled Status'
        }
    }
}

export function ValidationApiSettings({ settings }: { settings: Settings }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      validationResponse: settings.validationResponse,
    },
  });
  
  const watchedValues = form.watch();
  const initialValuesRef = useRef(JSON.stringify(form.getValues()));

  const debouncedSettingsUpdate = useDebouncedCallback(async (values: z.infer<typeof settingsSchema>) => {
    startTransition(async () => {
      const result = await updateSettings({ validationResponse: values.validationResponse });
      if (result.success) {
        toast({
          title: "Settings Saved",
          description: `Validation settings have been auto-saved.`,
        });
        initialValuesRef.current = JSON.stringify(values);
        router.refresh(); 
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to save settings.",
          variant: "destructive",
        })
      }
    });
  }, 1000);

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
        const currentValues = JSON.stringify(value);
        if (currentValues !== initialValuesRef.current) {
            debouncedSettingsUpdate(value as z.infer<typeof settingsSchema>);
        }
    });
    return () => subscription.unsubscribe();
  }, [form, debouncedSettingsUpdate]);


  const getSuccessResponseExample = () => {
    const vs = form.getValues('validationResponse');
    
    let example: any = { success: true, status: "success" };

    if (vs.customSuccessMessage.enabled && vs.customSuccessMessage.message) {
        example.message = vs.customSuccessMessage.message;
    }
    
    if (vs.license.enabled) {
        example.license = {};
        if(vs.license.fields.license_key) example.license.license_key = "LF-...";
        if(vs.license.fields.status) example.license.status = "active";
        if(vs.license.fields.expires_at) example.license.expires_at = "2025-12-31T23:59:59Z";
        if(vs.license.fields.issue_date) example.license.issue_date = "2024-01-01T00:00:00Z";
        if(vs.license.fields.max_ips) example.license.max_ips = 1;
        if(vs.license.fields.used_ips) example.license.used_ips = ["127.0.0.1"];
        if (Object.keys(example.license).length === 0) delete example.license;
    }
    if (vs.customer.enabled) {
        example.customer = {};
        if(vs.customer.fields.id) example.customer.id = "123456789012345678";
        if(vs.customer.fields.discord_id) example.customer.discord_id = "123456789012345678";
        if(vs.customer.fields.customer_since) example.customer.customer_since = "2024-01-01T00:00:00Z";
        if (Object.keys(example.customer).length === 0) delete example.customer;
    }
     if (vs.product.enabled) {
        example.product = {};
        if(vs.product.fields.id) example.product.id = "prod_...";
        if(vs.product.fields.name) example.product.name = "My Awesome App";
        if(vs.product.fields.enabled) example.product.enabled = true;
        if (Object.keys(example.product).length === 0) delete example.product;
    }
    return JSON.stringify(example, null, 2);
  }
  
  return (
    <div className="space-y-8">
      <Form {...form}>
        <form className="space-y-8">
          <Card>
              <CardHeader>
                  <CardTitle>Validation Endpoint Settings</CardTitle>
                  <CardDescription>
                      Customize the data objects and success message returned on a successful validation. Changes are auto-saved.
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                   <div className="space-y-2 rounded-lg border p-4">
                       <FormField
                          control={form.control}
                          name="validationResponse.requireDiscordId"
                          render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                  <FormLabel className="text-base">Require Discord ID</FormLabel>
                                  <FormDescription>
                                      If enabled, all validation requests must include a `discordId`.
                                  </FormDescription>
                              </div>
                              <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                              </FormControl>
                              </FormItem>
                          )}
                      />
                  </div>
                   <div className="space-y-2 rounded-lg border p-4">
                      <FormField
                          control={form.control}
                          name="validationResponse.customSuccessMessage.enabled"
                          render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                  <FormLabel className="text-base">Custom Success Message</FormLabel>
                                  <FormDescription>
                                      Enable or disable the 'message' field in success responses.
                                  </FormDescription>
                              </div>
                              <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                              </FormControl>
                              </FormItem>
                          )}
                      />
                       {watchedValues.validationResponse.customSuccessMessage.enabled && (
                           <FormField
                            control={form.control}
                            name="validationResponse.customSuccessMessage.message"
                            render={({ field }) => (
                              <FormItem className="pt-4">
                                <FormLabel>Success Message</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="License key is valid"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                       )}
                  </div>
                  
                  <Accordion type="multiple" className="w-full space-y-2">
                   {(Object.keys(validationResponseFieldDetails) as Array<keyof typeof validationResponseFieldDetails>).map((category) => (
                      <div key={category} className="space-y-2 rounded-lg border p-4">
                         <FormField
                          control={form.control}
                          name={`validationResponse.${category}.enabled`}
                          render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                  <FormLabel className="text-base">{validationResponseFieldDetails[category].label}</FormLabel>
                                  <FormDescription>
                                      {validationResponseFieldDetails[category].description}
                                  </FormDescription>
                              </div>
                              <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                              </FormControl>
                              </FormItem>
                          )}
                          />
                           {watchedValues.validationResponse[category as keyof typeof watchedValues.validationResponse].enabled && (
                              <AccordionItem value={category} className="border-b-0">
                                  <AccordionTrigger className="text-xs -ml-2 text-muted-foreground">
                                      Show granular options
                                  </AccordionTrigger>
                                  <AccordionContent className="pt-4 space-y-4">
                                       {(Object.keys(validationResponseFieldDetails[category].fields) as (keyof typeof validationResponseFieldDetails[typeof category]['fields'])[]).map((subField) => (
                                          <FormField
                                              key={subField}
                                              control={form.control}
                                              name={`validationResponse.${category}.fields.${subField}`}
                                              render={({ field }) => (
                                                   <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                                      <FormLabel className="font-normal">{validationResponseFieldDetails[category].fields[subField]}</FormLabel>
                                                      <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                                                      </FormControl>
                                                   </FormItem>
                                              )}
                                          />
                                       ))}
                                  </AccordionContent>
                              </AccordionItem>
                           )}
                      </div>
                   ))}
                  </Accordion>
              </CardContent>
          </Card>
        </form>
      </Form>
      
      <Card>
          <CardHeader>
              <CardTitle>Validation API Documentation</CardTitle>
              <CardDescription>How to use the public-facing validation endpoint in your application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="space-y-2">
                  <h3 className="font-semibold">Endpoint</h3>
                   <pre className="rounded-md bg-muted p-3 text-sm font-mono whitespace-pre-wrap break-all">
                      <span className="text-green-500 font-bold">POST</span> {settings.panelUrl ? `${settings.panelUrl}/api/validate` : 'https://<YOUR_APP_URL>/api/validate'}
                   </pre>
              </div>
              <div className="space-y-2">
                  <h3 className="font-semibold">Request Body</h3>
                  <CodeBlock language="json" code={JSON.stringify({
                      key: "LF-YOUR-LICENSE-KEY",
                      discordId: "USER_DISCORD_ID",
                      hwid: "USER_UNIQUE_HARDWARE_ID"
                  }, null, 2)} />
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li><code className="font-mono text-xs">key</code> (string, required): The license key to validate.</li>
                      <li><code className="font-mono text-xs">discordId</code> (string, optional): The Discord ID of the end-user. This is **required** if "Require Discord ID" setting is enabled.</li>
                      <li><code className="font-mono text-xs">hwid</code> (string, optional): The user's unique machine identifier. This is **required** if the product has HWID Protection enabled.</li>
                  </ul>
              </div>

               <Accordion type="multiple" className="w-full">
                  <AccordionItem value="success-response">
                      <AccordionTrigger>Example Success Response (200 OK)</AccordionTrigger>
                      <AccordionContent>
                          <p className="text-sm text-muted-foreground mb-2">The structure of the success response depends on your settings above. Here is a live preview based on your current configuration.</p>
                          <CodeBlock language="json" code={getSuccessResponseExample()} />
                      </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="failure-response">
                      <AccordionTrigger>Example Failure Responses (4xx)</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                           <div>
                              <p className="font-medium text-sm">Invalid License Key (403)</p>
                              <CodeBlock language="json" code={JSON.stringify({ success: false, status: "failure", message: "Invalid license key." }, null, 2)} />
                           </div>
                            <div>
                              <p className="font-medium text-sm">Discord ID Missing (400)</p>
                               <p className="text-xs text-muted-foreground mb-1">Returned when "Require Discord ID" is enabled but one was not provided.</p>
                              <CodeBlock language="json" code={JSON.stringify({ success: false, status: "failure", message: "Missing discordId." }, null, 2)} />
                           </div>
                           <div>
                              <p className="font-medium text-sm">Expired License (403)</p>
                              <CodeBlock language="json" code={JSON.stringify({ success: false, status: "failure", message: "License has expired." }, null, 2)} />
                           </div>
                           <div>
                              <p className="font-medium text-sm">HWID Required (403)</p>
                              <p className="text-xs text-muted-foreground mb-1">Returned when a product has HWID protection but no HWID was provided in the request.</p>
                              <CodeBlock language="json" code={JSON.stringify({ success: false, status: "failure", message: "This product requires a hardware ID for validation." }, null, 2)} />
                           </div>
                           <div>
                              <p className="font-medium text-sm">Max HWIDs Reached (403)</p>
                              <CodeBlock language="json" code={JSON.stringify({ success: false, status: "failure", message: "Maximum number of HWIDs reached for this license." }, null, 2)} />
                           </div>
                           <div>
                              <p className="font-medium text-sm">Max IPs Reached (403)</p>
                               <p className="text-xs text-muted-foreground mb-1">This happens if IP protection is enabled (not unlimited or disabled) and the IP is new, but the license has hit its max IPs.</p>
                              <CodeBlock language="json" code={JSON.stringify({ success: false, status: "failure", message: "Maximum number of IPs reached for this license." }, null, 2)} />
                           </div>
                      </AccordionContent>
                  </AccordionItem>
               </Accordion>
          </CardContent>
      </Card>
    </div>
  );
}

    