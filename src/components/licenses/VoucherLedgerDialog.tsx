

"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import type { Voucher, Product, License } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createVoucher, revokeVoucher } from "@/lib/actions";
import { getVouchers as readVouchers, getLicenses as readLicenses, fetchDiscordUser } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";
import { PlusCircle, Loader2, Ticket, CheckCircle, Copy, User, KeyRound, Calendar, FilePlus, RefreshCw, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CreateVoucherFormProps {
  products: Product[];
  onVoucherCreated: (voucher: Voucher) => void;
}

const voucherSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  duration: z.string().min(1, "Duration is required (e.g., 1m, 6m, 1y, lifetime)."),
});
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

function CreateVoucherForm({ products, onVoucherCreated }: CreateVoucherFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof voucherSchema>>({
    resolver: zodResolver(voucherSchema),
    defaultValues: { productId: '', duration: '' },
  });

  const handleCreateVoucher = (values: z.infer<typeof voucherSchema>) => {
    startTransition(async () => {
      const result = await createVoucher(values.productId, values.duration);
      if (result.success && result.voucher) {
        toast({ title: "Voucher Created", description: `Code: ${result.voucher.code}` });
        onVoucherCreated(result.voucher);
        form.reset();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message || "Failed to create voucher." });
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(handleCreateVoucher)} className="space-y-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Product</Label>
          <Select onValueChange={(value) => form.setValue('productId', value)}>
            <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
            <SelectContent>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>License Duration</Label>
          <Input {...form.register('duration')} placeholder="e.g., 1m, 1y, lifetime" />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Voucher"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface VoucherDetailsDialogProps {
    voucher: EnrichedVoucher;
    license?: License;
    redeemer?: { id: string; username: string };
    isOpen: boolean;
    onClose: () => void;
}

function VoucherDetailsDialog({ voucher, license, redeemer, isOpen, onClose }: VoucherDetailsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Voucher Details</DialogTitle>
                    <DialogDescription>
                        Information about voucher <code className="text-xs">{voucher.code}</code>.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Product</span>
                        <span className="font-medium">{voucher.productName}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">{voucher.duration}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Redeemed By</span>
                        <span className="font-medium">{redeemer?.username || 'N/A'} ({voucher.redeemedBy || 'N/A'})</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Redeemed At</span>
                        <span className="font-medium">{voucher.redeemedAt ? format(new Date(voucher.redeemedAt), 'PPP p') : 'N/A'}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Result</span>
                        {voucher.redeemAction ? (
                           <Badge variant="secondary" className="capitalize">{voucher.redeemAction}</Badge>
                        ) : (
                            <Badge variant="outline">N/A</Badge>
                        )}
                    </div>
                    {license && (
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Resulting License</span>
                            <code className="text-xs">{license.key}</code>
                        </div>
                    )}
                 </div>
                 <DialogFooter>
                    <Button onClick={onClose}>Close</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

type EnrichedVoucher = Voucher & { productName: string };

export function VoucherLedgerDialog({ products, onClose }: { products: Product[], onClose: () => void }) {
  const { toast } = useToast();
  const [isCreateMode, setCreateMode] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<EnrichedVoucher | null>(null);
  const [selectedLicense, setSelectedLicense] = useState<License | undefined>(undefined);
  const [redeemerUser, setRedeemerUser] = useState<{id: string, username: string} | undefined>(undefined);

  const fetchData = async () => {
      setIsLoading(true);
      const [vouchersData, licensesData] = await Promise.all([readVouchers(), readLicenses()]);
      setVouchers(vouchersData);
      setLicenses(licensesData);
      setIsLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);
  
  const handleVoucherCreated = (newVoucher: Voucher) => {
      setVouchers(currentVouchers => [newVoucher, ...currentVouchers]);
      setCreateMode(false);
  }
  
  const handleRevokeVoucher = async (code: string) => {
      const result = await revokeVoucher(code);
      if (result.success) {
          toast({ title: "Voucher Revoked", description: "The voucher has been successfully deleted." });
          fetchData(); // Refresh the list
      } else {
          toast({ variant: "destructive", title: "Error", description: result.message || "Failed to revoke voucher." });
      }
  }

  const enrichedVouchers = useMemo((): EnrichedVoucher[] => {
    return vouchers.map(v => {
      const product = products.find(p => p.id === v.productId);
      return {
        ...v,
        productName: product?.name || 'Unknown',
      };
    }).filter(v => v.code.toLowerCase().includes(searchTerm.toLowerCase()) || v.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [vouchers, products, searchTerm]);
  
  const handleVoucherClick = async (voucher: EnrichedVoucher) => {
      if (!voucher.isRedeemed || !voucher.redeemedBy) return;
      
      const relatedLicense = licenses.find(l => l.id === voucher.redeemedForLicenseId);

      const user = await fetchDiscordUser(voucher.redeemedBy);

      setRedeemerUser(user ? {id: user.id, username: user.username } : { id: voucher.redeemedBy, username: "Unknown User"});
      setSelectedLicense(relatedLicense);
      setSelectedVoucher(voucher);
  }
  
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Voucher code copied to clipboard." });
  };

  return (
    <>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Voucher Ledger</DialogTitle>
          <DialogDescription>
            Manage and create redeemable vouchers.
          </DialogDescription>
        </DialogHeader>
        
        {isCreateMode ? (
            <CreateVoucherForm products={products} onVoucherCreated={handleVoucherCreated} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
                <Input 
                    placeholder="Search by code or product name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                />
                <Button onClick={() => setCreateMode(true)}><PlusCircle className="mr-2"/> Create Voucher</Button>
                <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
            </div>
            <ScrollArea className="h-[450px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading vouchers...</TableCell></TableRow>
                    ) : enrichedVouchers.length > 0 ? (
                      enrichedVouchers.map((voucher) => (
                        <TableRow 
                            key={voucher.code} 
                            onClick={() => handleVoucherClick(voucher)}
                            className={cn(voucher.isRedeemed && "cursor-pointer hover:bg-muted/50")}
                        >
                          <TableCell className="font-mono text-xs">
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(voucher.code); }}>
                                            {voucher.code}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Copy to clipboard</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>{voucher.productName}</TableCell>
                          <TableCell>{voucher.duration}</TableCell>
                          <TableCell>
                            <Badge variant={voucher.isRedeemed ? "secondary" : "success"}>
                              {voucher.isRedeemed ? "Redeemed" : "Available"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDistanceToNow(new Date(voucher.createdAt), { addSuffix: true })}</TableCell>
                           <TableCell className="text-right">
                                {!voucher.isRedeemed && (
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently revoke the voucher <code className="text-xs">{voucher.code}</code>. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleRevokeVoucher(voucher.code)} className="bg-destructive hover:bg-destructive/90">
                                                    Revoke
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                           </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No vouchers found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {isCreateMode ? (
            <Button variant="outline" onClick={() => setCreateMode(false)}>Back to Ledger</Button>
          ) : (
            <Button variant="outline" onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
      {selectedVoucher && (
         <VoucherDetailsDialog 
            isOpen={!!selectedVoucher}
            onClose={() => setSelectedVoucher(null)}
            voucher={selectedVoucher}
            license={selectedLicense}
            redeemer={redeemerUser}
         />
      )}
    </>
  );
}
