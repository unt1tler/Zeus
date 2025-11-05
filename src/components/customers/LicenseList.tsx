
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal, Infinity, Pencil, Users } from "lucide-react";
import { useTransition, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
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
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { deleteLicense, updateLicenseStatus } from "@/lib/actions";
import type { License, Product } from "@/lib/types";
import { EditLicenseForm } from "./EditLicenseForm";
import { ManageSubUsersDialog } from "../licenses/ManageSubUsersDialog";

interface EnrichedLicense extends License {
  productName: string;
  ownerUsername?: string;
}

interface ColumnsOptions {
    products: Product[], 
    allLicenses: License[], 
    showActions?: boolean,
    onLicenseClick?: (key: string) => void;
}

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

export const getColumns = ({ products, allLicenses, showActions, onLicenseClick }: ColumnsOptions): ColumnDef<EnrichedLicense>[] => [
  ...(showActions ? [{
    id: "actions",
    cell: function ActionsCell({ row }: { row: { original: License } }) {
      const license = row.original;
      const { toast } = useToast();
      const [isPending, startTransition] = useTransition();
      const [isEditDialogOpen, setEditDialogOpen] = useState(false);
      const [isManageUsersOpen, setManageUsersOpen] = useState(false);

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
                Copy Key
              </DropdownMenuItem>
               <DropdownMenuItem onSelect={() => setManageUsersOpen(true)}>
                 <Users className="mr-2 h-4 w-4" />
                 Manage Sub-users
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEditDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4"/>
                Edit
              </DropdownMenuItem>
              {license.status === 'active' ? (
                <DropdownMenuItem onClick={() => handleStatusChange('inactive')} disabled={isPending}>
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleStatusChange('active')} disabled={isPending}>
                  Activate
                </DropdownMenuItem>
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
        </>
      );
    },
  }] : []),
  {
    accessorKey: "key",
    header: "License Key",
    cell: ({ row }) => {
      const { toast } = useToast();
      const key = row.getValue("key") as string;

      if (onLicenseClick) {
        return (
            <button
              className="p-0 h-auto font-mono text-xs hover:underline"
              onClick={() => onLicenseClick(key)}
            >
              {key.substring(0, 12)}...
            </button>
        )
      }

      return (
        <Button
          variant="link"
          className="p-0 font-mono text-xs"
          onClick={() => {
            navigator.clipboard.writeText(key);
            toast({ title: "Copied!", description: "License key copied to clipboard." });
          }}
        >
          {key.substring(0, 12)}...
        </Button>
      );
    },
  },
  {
    accessorKey: "productName",
    header: "Product",
  },
   {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original),
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
      id: "owner",
      header: "Owner",
      cell: ({ row }) => {
          const license = row.original;
          const owner = allLicenses.find(l => l.key === license.key)?.discordUsername
          return <Link href={`/customers/${license.discordId}`} className="hover:underline">{owner || license.discordId}</Link>
      }
  },
  {
    id: "usage",
    header: "Usage (IP/HWID)",
    cell: ({ row }) => {
        const license = row.original;
        const product = products.find(p => p.id === license.productId);
        
        const ipUsage = license.maxIps === -2
            ? 'N/A'
            : license.maxIps === -1 
            ? <div className="flex items-center gap-1">{license.allowedIps.length}/<Infinity className="h-4 w-4" /></div>
            : `${license.allowedIps.length}/${license.maxIps}`;
            
        const hwidUsage = !product?.hwidProtection
            ? 'N/A'
            : license.maxHwids === -1
            ? <div className="flex items-center gap-1">{license.allowedHwids.length}/<Infinity className="h-4 w-4" /></div>
            : `${license.allowedHwids.length}/${license.maxHwids}`;

        return <div className="flex items-center gap-2">{ipUsage} | {hwidUsage}</div>
    }
  },
];

export function LicenseList({ licenses, products, allLicenses, isSubUserList = false, showActions = false, onLicenseClick }: { licenses: EnrichedLicense[]; products: Product[], allLicenses: License[], isSubUserList?: boolean, showActions?: boolean, onLicenseClick?: (key: string) => void; }) {
  const columns = getColumns({ products, allLicenses, showActions: !isSubUserList && showActions, onLicenseClick });
  
  const filteredColumns = isSubUserList 
    ? columns.filter(c => c.id !== 'actions' && c.id !== 'usage')
    : columns.filter(c => c.id !== 'owner');

  return (
    <DataTable
      columns={filteredColumns}
      data={licenses}
      filterColumn="key"
      filterPlaceholder="Filter by license key..."
      noResultsMessage={isSubUserList ? "This user is not a sub-user on any licenses." : "No licenses found for this user."}
    />
  );
}
