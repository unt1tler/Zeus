
"use client";

import { useState, useMemo, useTransition } from "react";
import type { License, Product, Customer, Voucher } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import { CreateLicenseForm } from "./CreateLicenseForm";
import { createVoucher } from "@/lib/actions";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PlusCircle, RefreshCw, ChevronsUpDown, Loader2, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { VoucherLedgerDialog } from "./VoucherLedgerDialog";
import { getVouchers as readVouchers, getLicenses as readLicenses, getProducts as readProducts } from "@/lib/data";


type SortOption = "createdAt" | "expiresAt" | "status";
type FilterOption = "key" | "discordId" | "productId" | "status";

export function LicenseClient({ licenses: initialLicenses, products, allUsers }: { licenses: (License & { productName: string })[]; products: Product[]; allUsers: Customer[] }) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isVoucherOpen, setVoucherOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>("key");
  const [sortBy, setSortBy] = useState<SortOption>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Since we'll be revalidating, we can just use the initial prop
  const licenses = initialLicenses;

  const filteredAndSortedLicenses = useMemo(() => {
    let filtered = licenses;

    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      filtered = licenses.filter((license) => {
        switch (filterBy) {
          case 'productId':
            return license.productName.toLowerCase().includes(lowercasedSearchTerm);
          case 'discordId':
            const username = license.discordUsername?.toLowerCase() || '';
            const id = license.discordId.toLowerCase();
            return username.includes(lowercasedSearchTerm) || id.includes(lowercasedSearchTerm);
          case 'status': {
             const now = new Date();
             let effectiveStatus = license.status;
             if (license.status === 'active' && license.expiresAt && new Date(license.expiresAt) < now) {
                effectiveStatus = 'expired';
             }
             return effectiveStatus.toLowerCase().includes(lowercasedSearchTerm);
          }
          case 'key':
          default:
            const value = license[filterBy]?.toString().toLowerCase() || "";
            return value.includes(lowercasedSearchTerm);
        }
      });
    }

    return filtered.sort((a, b) => {
      let valA, valB;

      switch (sortBy) {
        case "createdAt":
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case "expiresAt":
          valA = a.expiresAt ? new Date(a.expiresAt).getTime() : (sortDirection === 'asc' ? Infinity : -Infinity);
          valB = b.expiresAt ? new Date(b.expiresAt).getTime() : (sortDirection === 'asc' ? Infinity : -Infinity);
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

  }, [licenses, searchTerm, filterBy, sortBy, sortDirection]);
  
  const getPlaceholder = () => {
    switch (filterBy) {
      case 'key': return 'Search by license key...';
      case 'discordId': return 'Search by Discord ID or username...';
      case 'productId': return 'Search by product name...';
      case 'status': return 'Search by status (active, inactive, expired)...';
      default: return 'Search...';
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-6">
                <div className="md:col-span-2">
                    <Label htmlFor="sort-by">Sort by</Label>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => {
                        setSearchTerm("");
                        setSortBy("createdAt");
                        setFilterBy("key");
                        setSortDirection("desc");
                        }}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                            <SelectTrigger id="sort-by">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="createdAt">Issue Date</SelectItem>
                                <SelectItem value="expiresAt">Expiration</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}>
                            <ChevronsUpDown className={cn("h-4 w-4 transform transition-transform", sortDirection === 'asc' && "rotate-180")}/>
                        </Button>
                    </div>
                </div>
                
                <div className="md:col-span-2">
                    <Label htmlFor="filter-by">Filter & Search</Label>
                    <div className="flex items-center gap-2">
                        <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                            <SelectTrigger id="filter-by" className="w-[150px]">
                                <SelectValue placeholder="Filter by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="key">License Key</SelectItem>
                                <SelectItem value="discordId">Customer</SelectItem>
                                <SelectItem value="productId">Product</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            id="search"
                            placeholder={getPlaceholder()}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                </div>

                <div className="flex w-full items-end gap-2 md:col-span-2">
                    <Dialog open={isVoucherOpen} onOpenChange={setVoucherOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Ticket className="mr-2 h-4 w-4" />
                                Vouchers
                            </Button>
                        </DialogTrigger>
                        <VoucherLedgerDialog 
                            products={products}
                            onClose={() => setVoucherOpen(false)}
                        />
                    </Dialog>
                    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                            <DialogTitle>Create a new License</DialogTitle>
                            <DialogDescription>
                                Fill out the form to issue a new license key. The key will be generated automatically.
                            </DialogDescription>
                            </DialogHeader>
                            <CreateLicenseForm products={products} allUsers={allUsers} onSuccess={() => setCreateOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <DataTable
            columns={columns(products, licenses)}
            data={filteredAndSortedLicenses}
            filterColumn="key"
            filterPlaceholder="Filter licenses..."
            hideDefaultFilter
        />
      </div>
    </>
  );
}
