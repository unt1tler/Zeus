
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { License, Product, Blacklist, Customer } from "@/lib/types";
import { PlusCircle, Ban, ShieldCheck, Mail, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { blacklistUser, unblacklistUser, updateCustomerEmail } from "@/lib/actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { CreateLicenseForm } from "@/components/licenses/CreateLicenseForm";
import { LicenseList } from "./LicenseList";
import { LicenseDetailsDialog } from "@/components/records/LicenseDetailsDialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface EnrichedLicense extends License {
  productName: string;
}

const emailSchema = z.object({
  email: z.string().email("Invalid email format.").or(z.literal("")),
});

interface CustomerProfileClientProps {
  customer: {
    id: string;
    discordUsername?: string;
    email?: string;
  };
  ownedLicenses: EnrichedLicense[];
  subUserLicenses: EnrichedLicense[];
  products: Product[];
  allLicenses: License[];
  allUsers: Customer[];
  isBlacklisted: boolean;
  blacklist: Blacklist;
}

export function CustomerProfileClient({
  customer,
  ownedLicenses,
  subUserLicenses,
  products,
  allLicenses,
  allUsers,
  isBlacklisted,
  blacklist,
}: CustomerProfileClientProps) {
  const [isCreateLicenseOpen, setCreateLicenseOpen] = useState(false);
  const [isEditEmailOpen, setEditEmailOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<EnrichedLicense | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: customer.email || "",
    },
  });
  
  const handleBlacklistUser = () => {
    startTransition(async () => {
        const result = await blacklistUser(customer.id);
        if (result.success) {
            toast({
                title: "User Blacklisted",
                description: "All associated IPs and HWIDs have been added to the blacklist, and their licenses deactivated.",
            });
        } else {
            toast({
                title: "Error",
                description: result.message || "Failed to blacklist user.",
                variant: "destructive",
            });
        }
    });
  }

  const handleUnblacklistUser = () => {
    startTransition(async () => {
        const result = await unblacklistUser(customer.id);
        if (result.success) {
            toast({
                title: "User Unblacklisted",
                description: "User has been removed from the blacklist.",
            });
        } else {
            toast({
                title: "Error",
                description: result.message || "Failed to unblacklist user.",
                variant: "destructive",
            });
        }
    });
  }
  
  const handleEmailUpdate = async (values: z.infer<typeof emailSchema>) => {
    startTransition(async () => {
      const result = await updateCustomerEmail(customer.id, values.email);
      if (result.success) {
        toast({ title: "Email updated successfully" });
        setEditEmailOpen(false);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };


  const handleLicenseClick = (key: string) => {
    const license = allLicenses.find(l => l.key === key);
    if(license) {
        const product = products.find(p => p.id === license.productId);
        setSelectedLicense({...license, productName: product?.name || "N/A" });
    }
  }

  const handleDialogClose = () => {
    setSelectedLicense(null);
  }
  
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={isCreateLicenseOpen} onOpenChange={setCreateLicenseOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2" /> Create License
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New License for {customer.discordUsername || customer.id}</DialogTitle>
            </DialogHeader>
            <CreateLicenseForm
              products={products}
              allUsers={allUsers}
              onSuccess={() => setCreateLicenseOpen(false)}
              initialValues={{ discordId: customer.id, discordUsername: customer.discordUsername, email: customer.email }}
            />
          </DialogContent>
        </Dialog>

        {isBlacklisted ? (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="secondary" disabled={isPending}>
                        <ShieldCheck className="mr-2" />
                        {isPending ? "Unblacklisting..." : "Remove from Blacklist"}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the user from the blacklist. Their previously associated IPs/HWIDs might remain if other blacklisted users share them. Their licenses will remain inactive.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnblacklistUser} disabled={isPending}>
                            Confirm Unblacklist
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        ) : (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isPending || ownedLicenses.length === 0}>
                        <Ban className="mr-2" />
                        {isPending ? "Blacklisting..." : "Add to Blacklist"}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will add all IPs and HWIDs associated with this user's owned licenses to the blacklist and deactivate all their owned licenses. This can be reversed, but licenses must be manually reactivated.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBlacklistUser} disabled={isPending}>
                            Confirm Blacklist
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </div>

       <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4"/>
        <span>{customer.email || 'No email set'}</span>
        <Dialog open={isEditEmailOpen} onOpenChange={setEditEmailOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6"><Pencil className="h-3 w-3"/></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Email</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleEmailUpdate)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="customer@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                             <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Saving...' : 'Save Email'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Owned Licenses</CardTitle>
            <CardDescription>Licenses directly owned by this customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <LicenseList licenses={ownedLicenses} products={products} allLicenses={allLicenses} showActions={true} onLicenseClick={handleLicenseClick} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
              <CardTitle>Sub-user On</CardTitle>
              <CardDescription>
                Licenses this user has access to as a sub-user.
              </CardDescription>
          </CardHeader>
          <CardContent>
              <LicenseList licenses={subUserLicenses} products={products} allLicenses={allLicenses} showActions={false} isSubUserList={true} onLicenseClick={handleLicenseClick} />
          </CardContent>
        </Card>
      </div>
      
      {selectedLicense && (
        <LicenseDetailsDialog
            license={selectedLicense}
            blacklist={blacklist}
            isOpen={!!selectedLicense}
            onClose={handleDialogClose}
        />
      )}
    </>
  );
}
