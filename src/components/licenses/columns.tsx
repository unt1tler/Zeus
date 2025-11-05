
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format, formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, CopyIcon, Pencil, Users, RotateCw } from "lucide-react";
import { useTransition, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteLicense, updateLicenseStatus } from "@/lib/actions";
import type { License, Product } from "@/lib/types";
import { EditLicenseForm } from "@/components/customers/EditLicenseForm";
import { ManageSubUsersDialog } from "./ManageSubUsersDialog";
import { RenewLicenseDialog } from "./RenewLicenseDialog";


function getStatusBadge(license: License) {
  const now = new Date();
  if (license.status === 'inactive') {
    return <Badge variant="secondary">Inactive</Badge>;
  }
  if (license.status === 'expired' || (license.expiresAt && new Date(license.expiresAt) < now)) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  return <Badge variant="success">Active</Badge>;
}

export const columns = (products: Product[], allLicenses: License[]): ColumnDef<License & { productName: string }>[] => [
  {
    id: "actions",
    cell: function ActionsCell({ row }: { row: { original: License } }) {
      const license = row.original;
      const { toast } = useToast();
      const [isPending, startTransition] = useTransition();
      const [isEditDialogOpen, setEditDialogOpen] = useState(false);
      const [isManageUsersOpen, setManageUsersOpen] = useState(false);
      const [isRenewOpen, setRenewOpen] = useState(false);

      const isExpired = license.status === 'expired' || (license.expiresAt && new Date(license.expiresAt) < new Date());

      const handleStatusChange = (status: 'active' | 'inactive') => {
        startTransition(async () => {
          const result = await updateLicenseStatus(license.key, status);
          if(result.success) {
            toast({ title: "Success", description: `License has been ${status === 'active' ? 'activated' : 'deactivated'}.` });
          } else {
             toast({ title: "Error", description: result.message, variant: "destructive" });
          }
        });
      };
      
      const handleDelete = () => {
        startTransition(async () => {
            await deleteLicense(license.key);
            toast({ title: "Success", description: "License has been deleted." });
        });
      }

      return (
        <>
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(license.key);
                    toast({ title: "Copied!", description: "License key copied to clipboard." });
                  }}
                >
                  <CopyIcon className="mr-2 h-4 w-4" /> Copy Key
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                    <Link href={`/customers/${license.discordId}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Customer
                    </Link>
                </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => setManageUsersOpen(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    Manage Sub-users
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setEditDialogOpen(true)} disabled={isPending}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                
                {isExpired ? (
                    <DropdownMenuItem onSelect={() => setRenewOpen(true)} disabled={isPending}>
                       <RotateCw className="mr-2 h-4 w-4" /> Renew
                    </DropdownMenuItem>
                ) : (
                    license.status === 'active' ? (
                    <DropdownMenuItem onClick={() => handleStatusChange('inactive')} disabled={isPending}>
                        Deactivate
                    </DropdownMenuItem>
                    ) : (
                    <DropdownMenuItem onClick={() => handleStatusChange('active')} disabled={isPending}>
                        Activate
                    </DropdownMenuItem>
                    )
                )}
                
                <AlertDialogTrigger asChild>
                   <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>Delete</DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this
                    license and remove its data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                      {isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit License: {license.key.substring(0, 15)}...</DialogTitle>
              </DialogHeader>
              <EditLicenseForm license={license} products={products} onSuccess={() => setEditDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          <ManageSubUsersDialog 
            license={license}
            isOpen={isManageUsersOpen}
            onClose={() => setManageUsersOpen(false)}
          />

          <RenewLicenseDialog
            license={license}
            isOpen={isRenewOpen}
            onClose={() => setRenewOpen(false)}
          />
        </>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original),
  },
  {
    accessorKey: "key",
    header: "License Key",
    cell: ({ row }) => {
      const key = row.getValue("key") as string;
      return (
        <span className="font-mono text-xs">
          {key}
        </span>
      );
    },
  },
  {
    accessorKey: "discordUsername",
    header: "Customer",
    cell: ({ row }) => {
        const license = row.original;
        return (
            <Link href={`/customers/${license.discordId}`} className="inline-flex items-center gap-1 hover:underline">
              {license.discordUsername || license.discordId}
              <ExternalLink className="h-3 w-3" />
            </Link>
        )
    }
  },
  {
    accessorKey: "productName",
    header: "Product",
    cell: ({ row }) => {
      const { productName } = row.original;
      return (
        <div className="flex items-center gap-1">
          {productName}
        </div>
      )
    }
  },
  {
    accessorKey: "expiresAt",
    header: "Expires At",
    cell: ({ row }) => {
      const expiresAt = row.getValue("expiresAt") as string | null;
      return expiresAt ? format(new Date(expiresAt), "MMM dd, yyyy") : "Never";
    },
  },
  {
    accessorKey: "createdAt",
    header: "Issue date",
    cell: ({ row }) => {
      const createdAt = row.getValue("createdAt") as string;
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
    },
  },
    {
    id: "usage",
    header: "Usage (IP/HWID)",
    cell: ({ row }) => {
        const license = row.original as License & { productName: string };
        const product = products.find(p => p.id === license.productId);

        const ipUsage = license.maxIps === -2 
            ? 'N/A' 
            : license.maxIps === -1 
            ? 'Unlimited' 
            : `${license.allowedIps.length}/${license.maxIps}`;
            
        const hwidUsage = product?.hwidProtection 
            ? (license.maxHwids === -1 ? 'Unlimited' : `${license.allowedHwids.length}/${license.maxHwids}`)
            : 'N/A';
            
        return `${ipUsage} | ${hwidUsage}`;
    }
  },
  {
    accessorKey: "updatedAt",
    header: "Last Updated",
    cell: ({ row }) => {
        const updatedAt = row.original.updatedAt;
        return updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : 'Never';
    }
  },
];
