

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useMemo } from "react";
import { CalendarIcon, ChevronsUpDown, Check } from "lucide-react";
import { format, addMonths, addYears } from "date-fns";
import { createLicense } from "@/lib/actions";
import type { Product, Customer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const licenseSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  platform: z.string().min(1, "Platform is required."),
  platformUserId: z.string().optional(),
  discordId: z.string().min(1, "Discord ID is required."),
  discordUsername: z.string().optional(),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  subUserDiscordIds: z.string().optional(),
  expiresAt: z.date().optional().nullable(),
  disableIpProtection: z.boolean().default(false),
  unlimitedIps: z.boolean().default(false),
  maxIps: z.string().optional(),
  unlimitedHwids: z.boolean().default(false),
  maxHwids: z.coerce.number().min(0, "Must be 0 or greater").default(1),
}).superRefine((data, ctx) => {
    if (!data.disableIpProtection && !data.unlimitedIps) {
        if (data.maxIps === undefined || data.maxIps.trim() === '') {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['maxIps'],
                message: 'Max IPs is required when IP protection is enabled.',
            });
            return;
        }
        const maxIpsNum = Number(data.maxIps);
        if (isNaN(maxIpsNum) || maxIpsNum < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['maxIps'],
                message: 'Number must be greater than or equal to 0',
            });
        }
    }
});

interface CreateLicenseFormProps {
    products: Product[];
    allUsers: Customer[];
    onSuccess: () => void;
    initialValues?: Partial<z.infer<typeof licenseSchema>>;
}

export function CreateLicenseForm({ products, allUsers, onSuccess, initialValues }: CreateLicenseFormProps) {
  const { toast } = useToast();
  const [openUserSelector, setOpenUserSelector] = useState(false);

  const form = useForm<z.infer<typeof licenseSchema>>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      productId: "",
      platform: "custom",
      platformUserId: "",
      discordId: "",
      discordUsername: "",
      email: "",
      subUserDiscordIds: "",
      expiresAt: null,
      disableIpProtection: false,
      unlimitedIps: false,
      maxIps: "1",
      unlimitedHwids: false,
      maxHwids: 1,
      ...initialValues
    },
  });

  const watchProductId = form.watch("productId");
  const selectedProduct = useMemo(() => products.find(p => p.id === watchProductId), [products, watchProductId]);
  
  const handleUserSelect = (user: Customer) => {
    form.setValue("discordId", user.discordId);
    form.setValue("discordUsername", user.discordUsername);
    if(user.email) {
      form.setValue("email", user.email);
    }
    setOpenUserSelector(false);
  };
  
  const setExpiration = (duration: '1m' | '1y' | 'never') => {
      if (duration === 'never') {
          form.setValue('expiresAt', null);
          return;
      }
      const now = new Date();
      let newDate: Date;
      if (duration === '1m') newDate = addMonths(now, 1);
      else newDate = addYears(now, 1);
      form.setValue('expiresAt', newDate);
  }

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
    return "Custom Platform ID";
  }

  async function onSubmit(values: z.infer<typeof licenseSchema>) {
    let maxIpsValue: number;
    if (values.disableIpProtection) {
        maxIpsValue = -2;
    } else if (values.unlimitedIps) {
        maxIpsValue = -1;
    } else {
        maxIpsValue = Number(values.maxIps);
    }

    const payload = {
        ...values,
        maxIps: maxIpsValue,
        maxHwids: selectedProduct?.hwidProtection ? (values.unlimitedHwids ? -1 : values.maxHwids) : -1,
        subUserDiscordIds: values.subUserDiscordIds ? values.subUserDiscordIds.split(',').map(id => id.trim()).filter(id => id) : [],
    };

    const result = await createLicense(payload);

    if (result?.errors) {
       Object.entries(result.errors).forEach(([key, messages]) => {
            form.setError(key as any, {
                type: 'server',
                message: (messages as string[]).join(', '),
            });
        });
       toast({
        variant: "destructive",
        title: "Error creating license",
        description: "Please check the form for errors and try again.",
      });
    } else {
      toast({
        title: "Success",
        description: "License created successfully.",
      });
      form.reset();
      onSuccess();
    }
  }

  return (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <FormField
            control={form.control}
            name="productId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Product</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                        {product.name}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
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
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                    <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => setExpiration('1m')}>1 Month</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setExpiration('1y')}>1 Year</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setExpiration('never')}>Lifetime</Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-base font-semibold text-foreground">Customer Details</h3>
             <FormItem>
                <FormLabel>Assign to Existing Customer (Optional)</FormLabel>
                 <Popover open={openUserSelector} onOpenChange={setOpenUserSelector}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {form.getValues().discordId
                          ? allUsers.find((user) => user.id === form.getValues().discordId)?.discordUsername ?? "Select customer..."
                          : "Select customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {allUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.discordUsername}
                              onSelect={() => handleUserSelect(user)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.getValues().discordId === user.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {user.discordUsername} ({user.isOwner ? 'Owner' : 'Member'})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                 <FormDescription>Select a pre-existing user to pre-fill their details.</FormDescription>
            </FormItem>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="discordId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Owner Discord ID</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. 123456789012345678" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="discordUsername"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Discord Username (Optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="user@example.com" {...field} />
                        </FormControl>
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
             <FormField
                    control={form.control}
                    name="subUserDiscordIds"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Sub-users (Optional)</FormLabel>
                        <FormControl>
                           <Textarea placeholder="Enter comma-separated Discord IDs" {...field} />
                        </FormControl>
                        <FormDescription>These users will also be able to validate this license key.</FormDescription>
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
                 {selectedProduct?.hwidProtection && (
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
            {form.formState.isSubmitting ? "Creating..." : "Create License"}
            </Button>
        </DialogFooter>
        </form>
    </Form>
  )
}
