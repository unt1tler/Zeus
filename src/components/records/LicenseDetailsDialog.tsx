
"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateLicenseStatus, blacklistLicenseIdentifiers } from "@/lib/actions";
import type { License, Blacklist } from "@/lib/types";
import Link from "next/link";
import {
  KeyRound,
  User,
  ExternalLink,
  Ban,
  CircleOff,
  Package,
  Calendar,
  Server,
  Globe,
  Tag,
  CalendarPlus,
  Webhook,
} from "lucide-react";

interface LicenseDetailsDialogProps {
  license: (License & { productName: string });
  blacklist: Blacklist;
  isOpen: boolean;
  onClose: () => void;
}

export function LicenseDetailsDialog({ license, blacklist, isOpen, onClose }: LicenseDetailsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isLicenseRevoked = license.status !== 'active';
  
  const allIdentifiers = [...license.allowedIps, ...license.allowedHwids];
  const areAllBlacklisted = allIdentifiers.length > 0 && allIdentifiers.every(
      id => blacklist.ips.includes(id) || blacklist.hwids.includes(id)
  );

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await updateLicenseStatus(license.key, "inactive");
      if (result.success) {
        toast({ title: "Success", description: "License has been revoked." });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      onClose();
    });
  };

  const handleBlacklist = () => {
    startTransition(async () => {
        const result = await blacklistLicenseIdentifiers(license.key);
        if (result.success) {
            toast({ title: "Success", description: "All IPs and HWIDs on this license have been blacklisted." });
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        onClose();
    })
  }

  const InfoRow = ({ icon, label, children }: { icon: React.ReactNode, label: string, children: React.ReactNode }) => (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-right text-sm">{children}</div>
    </div>
  );
  
  const getSourceName = (source?: string) => {
    if (source === 'builtbybit-placeholder') return 'BuiltByBit Placeholder';
    if (source === 'builtbybit-webhook') return 'BuiltByBit Webhook';
    return 'Manual Creation';
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
             <KeyRound className="h-6 w-6 text-primary" />
             <div>
                <DialogTitle>License Details</DialogTitle>
                <DialogDescription>
                   <code className="text-xs">{license.key}</code>
                </DialogDescription>
             </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 divide-y divide-border border-y py-2 px-1">
          <InfoRow icon={<Package className="h-4 w-4 text-muted-foreground"/>} label="Product">
            <span>{license.productName}</span>
          </InfoRow>
          <InfoRow icon={<User className="h-4 w-4 text-muted-foreground"/>} label="Owner">
            <Link href={`/customers/${license.discordId}`} className="flex items-center gap-2 hover:underline" onClick={(e) => { e.stopPropagation(); onClose(); }}>
              <span>{license.discordUsername || license.discordId}</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </InfoRow>
           <InfoRow icon={<Tag className="h-4 w-4 text-muted-foreground"/>} label="Status">
            <Badge variant={license.status === "active" ? "success" : "destructive"}>
              {license.status}
            </Badge>
          </InfoRow>
           <InfoRow icon={<Webhook className="h-4 w-4 text-muted-foreground"/>} label="Source">
            <span>{getSourceName(license.source)}</span>
          </InfoRow>
           <InfoRow icon={<CalendarPlus className="h-4 w-4 text-muted-foreground"/>} label="Created Date">
            <span>{format(new Date(license.createdAt), "PPP")}</span>
          </InfoRow>
          <InfoRow icon={<Calendar className="h-4 w-4 text-muted-foreground"/>} label="Expiration Date">
            <span>{license.expiresAt ? format(new Date(license.expiresAt), "PPP") : "Never"}</span>
          </InfoRow>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-md border p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4" /> Allowed IPs ({license.allowedIps.length}/{license.maxIps === -1 ? '∞' : (license.maxIps === -2 ? 'N/A' : license.maxIps)})</h4>
                {license.allowedIps.length > 0 ? (
                    <div className="space-y-1 text-xs font-mono">
                        {license.allowedIps.map(ip => <div key={ip}>{ip}</div>)}
                    </div>
                ) : <p className="text-xs text-muted-foreground">No IPs used yet.</p>}
            </div>
             <div className="space-y-2 rounded-md border p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><Server className="h-4 w-4" /> Allowed HWIDs ({license.allowedHwids.length}/{license.maxHwids === -1 ? '∞' : license.maxHwids})</h4>
                {license.allowedHwids.length > 0 ? (
                     <div className="space-y-1 text-xs font-mono">
                        {license.allowedHwids.map(hwid => <div key={hwid}>{hwid}</div>)}
                    </div>
                ) : <p className="text-xs text-muted-foreground">No HWIDs used yet.</p>}
            </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:justify-start">
            <Button variant="outline" onClick={handleRevoke} disabled={isPending || isLicenseRevoked}>
                <CircleOff className="mr-2" />
                {isPending ? "Revoking..." : "Revoke License"}
            </Button>
          <Button variant="destructive" onClick={handleBlacklist} disabled={isPending || areAllBlacklisted || allIdentifiers.length === 0}>
            <Ban className="mr-2" />
             {isPending ? "Blacklisting..." : "Blacklist Identifiers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
