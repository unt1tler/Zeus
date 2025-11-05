
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { updateLicense } from "@/lib/actions";
import type { License, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "../ui/checkbox";

const editLicenseSchema = z.object({
  platform: z.string().min(1, "Platform is required."),
  platformUserId: z.string().optional(),
  expiresAt: z.date().optional().nullable(),
  disableIpProtection: z.boolean().default(false),
  unlimitedIps: z.boolean().default(false),
  maxIps: z.string().optional(),
  unlimitedHwids: z.boolean().default(false),
  maxHwids: z.coerce.number().min(0).default(1),
}).transform((data) => {
    if (!data.disableIpProtection && !data.unlimitedIps) {
        const maxIpsNum = Number(data.maxIps);
        if (isNaN(maxIpsNum) || maxIpsNum < 0) {
            throw new Error("Max IPs must be a positive number.");
        }
        return { ...data, maxIps: maxIpsNum };
    }
    return { ...data, maxIps: undefined };
});


interface EditLicenseFormProps {
    license: License;
    products: Product[];
    onSuccess: () => void;
}

export function EditLicenseForm({ license, products, onSuccess }: EditLicenseFormProps) {
  const { toast } = useToast();
  const product = products.find(p => p.id === license.productId);
  const isHwidProtected = product?.hwidProtection || false;

  const form = useForm({
    resolver: zodResolver(editLicenseSchema),
    defaultValues: {
      platform: license.platform,
      platformUserId: license.platformUserId || "",
      expiresAt: license.expiresAt ? new Date(license.expiresAt) : null,
      disableIpProtection: license.maxIps === -2,
      unlimitedIps: license.maxIps === -1,
      maxIps: license.maxIps >= 0 ? String(license.maxIps) : "1",
      unlimitedHwids: license.maxHwids === -1,
      maxHwids: license.maxHwids >= 0 ? license.maxHwids : 1,
    },
  });

  const watchPlatform = form.watch("platform");
  const watchDisableIpProtection = form.watch("disableIpProtection");
  const watchUnlimitedIps = form.watch("unlimitedIps");
  const watchUnlimitedHwids = form.watch("unlimitedHwids");
  
  const getPlatformLabel = (platform: string) => {
    const knownPlatforms = ["spigot", "builtbybit", "polymart"];
    if (knownPlatforms.includes(platform)) {
        if (platform === 'builtbybit') return "BuiltByBit User ID";
        return `${platform.charAt(0).toUpperCase() + platform.slice(1)} User ID`;
    }
    return `Custom Platform ID`;
  }
  
  async function onSubmit(values: any) {
    const formData = new FormData();
    formData.append("platform", values.platform);
    formData.append("platformUserId", values.platformUserId || "");
    if (values.expiresAt) {
      formData.append("expiresAt", values.expiresAt.toISOString());
    } else {
      formData.append("expiresAt", ""); // Explicitly send empty for 'Never'
    }

    let maxIpsValue;
    if (values.disableIpProtection) {
        maxIpsValue = -2;
    } else if (values.unlimitedIps) {
        maxIpsValue = -1;
    } else {
        maxIpsValue = Number(values.maxIps);
    }
    formData.append("maxIps", String(maxIpsValue));

    formData.append("maxHwids", values.unlimitedHwids ? "-1" : String(values.maxHwids));


    const result = await updateLicense(license.key, formData);

    if (result?.errors) {
       toast({
        variant: "destructive",
        title: "Error updating license",
        description: "Please check the form for errors and try again.",
      });
    } else {
      toast({
        title: "Success",
        description: "License updated successfully.",
      });
      onSuccess();
    }
  }

  return (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Expiration Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date (or leave for lifetime)</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={field.onChange}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormDescription>Leave blank for a lifetime license.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="spigot">Spigot</SelectItem>
                            <SelectItem value="builtbybit">BuiltByBit</SelectItem>
                            <SelectItem value="polymart">Polymart</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="platformUserId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{getPlatformLabel(watchPlatform)}</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. 123456" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        
        <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-base font-semibold text-foreground">Restrictions</h3>
            <div className="grid grid-cols-1 gap-6 pt-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormField
                        control={form.control}
                        name="disableIpProtection"
                        render={({ field }) => (
                            <FormItem className="flex flex-1 flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (checked) {
                                        form.setValue('unlimitedIps', false);
                                    }
                                }}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                Disable IP Protection
                                </FormLabel>
                                <FormDescription>
                                No IP checks will be performed for this license.
                                </FormDescription>
                            </div>
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
                            <Input type="number" min="0" {...field} disabled={watchUnlimitedIps || watchDisableIpProtection} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="unlimitedIps"
                        render={({ field }) => (
                            <FormItem className="flex flex-1 flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={watchDisableIpProtection}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                Allow Unlimited IPs
                                </FormLabel>
                                <FormDescription>
                                IPs will be tracked, but there is no limit.
                                </FormDescription>
                            </div>
                            </FormItem>
                        )}
                    />
                </div>
                 {isHwidProtected && (
                    <div className="flex flex-col gap-2">
                        <FormField
                            control={form.control}
                            name="maxHwids"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Max HWIDs</FormLabel>
                                <FormControl>
                                <Input type="number" min="0" {...field} disabled={watchUnlimitedHwids} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="unlimitedHwids"
                            render={({ field }) => (
                                <FormItem className="flex flex-1 flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>
                                    Allow Unlimited HWIDs
                                    </FormLabel>
                                    <FormDescription>
                                    HWIDs will be tracked, but there is no limit.
                                    </FormDescription>
                                </div>
                                </FormItem>
                            )}
                        />
                    </div>
                 )}
            </div>
        </div>

        <DialogFooter>
            <DialogClose asChild>
            <Button type="button" variant="secondary">
                Cancel
            </Button>
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
        </DialogFooter>
        </form>
    </Form>
  )
}

    