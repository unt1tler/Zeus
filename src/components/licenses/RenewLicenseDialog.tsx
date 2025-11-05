
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { format, addMonths, addYears } from "date-fns";
import { CalendarIcon, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renewLicense } from "@/lib/actions";
import type { License } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface RenewLicenseDialogProps {
  license: License;
  isOpen: boolean;
  onClose: () => void;
}

const renewSchema = z.object({
  expiresAt: z.date({ required_error: "New expiration date is required." }),
});

export function RenewLicenseDialog({ license, isOpen, onClose }: RenewLicenseDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof renewSchema>>({
    resolver: zodResolver(renewSchema),
    defaultValues: {
      expiresAt: addMonths(new Date(), 1), // Default to one month from now
    },
  });

  const setExpiration = (duration: '1m' | '6m' | '1y') => {
      const now = new Date();
      let newDate: Date;
      if (duration === '1m') newDate = addMonths(now, 1);
      else if (duration === '6m') newDate = addMonths(now, 6);
      else newDate = addYears(now, 1);
      form.setValue('expiresAt', newDate);
  }

  const onSubmit = (values: z.infer<typeof renewSchema>) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("key", license.key);
      formData.append("expiresAt", values.expiresAt.toISOString());
      
      const result = await renewLicense(formData);
      if (result.success) {
        toast({ title: "Success", description: "License renewed successfully." });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to renew license.",
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew License</DialogTitle>
          <DialogDescription>
            Extend the expiration for <code className="font-mono text-xs">{license.key}</code>.
            The license status will be set to 'active'.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>New Expiration Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-2 pt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setExpiration('1m')}>+1 Month</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setExpiration('6m')}>+6 Months</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setExpiration('1y')}>+1 Year</Button>
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                <RotateCw className="mr-2 h-4 w-4" />
                {isPending ? "Renewing..." : "Renew License"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
