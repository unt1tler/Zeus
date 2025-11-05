
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { addSubUserToLicense, removeSubUserFromLicense } from "@/lib/actions";
import type { License } from "@/lib/types";

interface ManageSubUsersDialogProps {
  license: License;
  isOpen: boolean;
  onClose: () => void;
}

const subUserSchema = z.object({
  discordId: z.string().min(1, "Discord ID is required."),
});

export function ManageSubUsersDialog({ license, isOpen, onClose }: ManageSubUsersDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof subUserSchema>>({
    resolver: zodResolver(subUserSchema),
    defaultValues: { discordId: "" },
  });

  const onSubmit = (values: z.infer<typeof subUserSchema>) => {
    startTransition(async () => {
      const result = await addSubUserToLicense(license.key, values.discordId);
      if (result.success) {
        toast({ title: "Success", description: "Sub-user added successfully." });
        form.reset();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };

  const handleRemove = (discordId: string) => {
    startTransition(async () => {
      const result = await removeSubUserFromLicense(license.key, discordId);
      if (result.success) {
        toast({ title: "Success", description: "Sub-user removed." });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Sub-users</DialogTitle>
          <DialogDescription>
            Add or remove users who can use this license key: <code className="text-xs font-mono">{license.key.substring(0, 15)}...</code>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Current Sub-users</h4>
            <div className="space-y-2">
              {(license.subUserDiscordIds || []).length > 0 ? (
                (license.subUserDiscordIds || []).map((id) => (
                  <div key={id} className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-mono">{id}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No sub-users yet.</p>
              )}
            </div>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full items-start gap-2">
              <FormField
                control={form.control}
                name="discordId"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Enter Discord ID to add..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending}>
                <PlusCircle className="mr-2" /> Add
              </Button>
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    