
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
import { updateLicenseStatus, addToBlacklist } from "@/lib/actions";
import type { EnrichedValidationLog } from "@/app/(dashboard)/records/page";
import type { License, Blacklist } from "@/lib/types";
import Link from "next/link";
import {
  ShieldAlert,
  User,
  ExternalLink,
  Ban,
  CircleOff,
  KeyRound,
  Globe,
  Tag,
  MessageSquareWarning,
  Server,
  Package,
} from "lucide-react";

interface RecordDetailsDialogProps {
  record: EnrichedValidationLog;
  licenses: License[];
  blacklist: Blacklist;
  isOpen: boolean;
  onClose: () => void;
  onLicenseClick: (key: string) => void;
}

export function RecordDetailsDialog({ record, licenses, blacklist, isOpen, onClose, onLicenseClick }: RecordDetailsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const targetLicense = licenses.find(l => l.key === record.licenseKey);
  const isLicenseRevoked = !targetLicense || targetLicense.status !== 'active';
  const isIpBlacklisted = blacklist.ips.includes(record.ipAddress);
  const isHwidBlacklisted = record.hwid ? blacklist.hwids.includes(record.hwid) : false;

  const handleRevoke = () => {
    if (!targetLicense) return;
    startTransition(async () => {
      const result = await updateLicenseStatus(targetLicense.key, "inactive");
      if (result.success) {
        toast({ title: "Success", description: "License has been revoked." });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      onClose();
    });
  };

  const handleBlacklist = (type: "ip" | "hwid", value: string | null) => {
    if (!value) {
      toast({ title: "Error", description: `No ${type.toUpperCase()} to blacklist.`, variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("value", value);
      const result = await addToBlacklist(formData);
      if (result.success) {
        toast({ title: "Success", description: `${type.toUpperCase()} has been blacklisted.` });
      } else {
        toast({ title: "Error", description: "Failed to blacklist.", variant: "destructive" });
      }
      onClose();
    });
  };

  const InfoRow = ({ icon, label, children }: { icon: React.ReactNode, label: string, children: React.ReactNode }) => (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-right text-sm">{children}</div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
             <ShieldAlert className="h-6 w-6 text-primary" />
             <div>
                <DialogTitle>Validation Record Details</DialogTitle>
                <DialogDescription>
                    {format(new Date(record.timestamp), "MMMM dd, yyyy 'at' HH:mm:ss")}
                </DialogDescription>
             </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 divide-y divide-border border-y py-2 px-1">
          <InfoRow icon={<Tag className="h-4 w-4 text-muted-foreground"/>} label="Validation Status">
            <Badge variant={record.status === "success" ? "success" : "destructive"}>
              {record.status}
            </Badge>
          </InfoRow>
           {record.reason && (
            <InfoRow icon={<MessageSquareWarning className="h-4 w-4 text-muted-foreground"/>} label="Reason">
              <span className="font-medium">{record.reason}</span>
            </InfoRow>
          )}
           <InfoRow icon={<KeyRound className="h-4 w-4 text-muted-foreground"/>} label="License Key">
            <button 
                className="text-xs hover:underline disabled:no-underline disabled:cursor-not-allowed" 
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(); // Close this dialog
                    onLicenseClick(record.licenseKey); // Open the license dialog
                }}
                disabled={record.licenseKey === 'N/A'}
            >
                <code className="text-xs">{record.licenseKey}</code>
            </button>
          </InfoRow>
          {targetLicense && (
             <InfoRow icon={<Tag className="h-4 w-4 text-muted-foreground" />} label="License Status">
                <Badge variant={targetLicense.status === "active" ? "success" : "destructive"}>
                    {targetLicense.status}
                </Badge>
            </InfoRow>
          )}
          <InfoRow icon={<User className="h-4 w-4 text-muted-foreground"/>} label="Customer">
             {record.discordId !== 'N/A' ? (
                <Link href={`/customers/${record.discordId}`} className="flex items-center gap-2 hover:underline" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                    <div className="flex flex-col items-end">
                        <span className="font-medium">{record.customerUsername || "N/A"}</span>
                        <span className="text-xs text-muted-foreground">{record.discordId}</span>
                    </div>
                  <ExternalLink className="h-4 w-4" />
                </Link>
             ) : <span>N/A</span>}
          </InfoRow>
           <InfoRow icon={<Package className="h-4 w-4 text-muted-foreground"/>} label="Product">
            <span className="font-medium">{record.productName}</span>
          </InfoRow>
          <InfoRow icon={<Globe className="h-4 w-4 text-muted-foreground"/>} label="IP Address">
            <code className="text-xs">{record.ipAddress}</code>
          </InfoRow>
          {record.hwid && (
            <InfoRow icon={<Server className="h-4 w-4 text-muted-foreground"/>} label="HWID">
              <code className="text-xs">{record.hwid}</code>
            </InfoRow>
          )}
          {record.location && (
             <InfoRow icon={<Globe className="h-4 w-4 text-muted-foreground"/>} label="Location">
              <span className="font-medium">{record.location.city}, {record.location.country}</span>
            </InfoRow>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2 sm:justify-start">
           {targetLicense && (
             <Button variant="outline" onClick={handleRevoke} disabled={isPending || isLicenseRevoked}>
                <CircleOff className="mr-2" />
                {isPending ? "Revoking..." : "Revoke License"}
            </Button>
          )}
          <Button variant="destructive" onClick={() => handleBlacklist('ip', record.ipAddress)} disabled={isPending || isIpBlacklisted}>
            <Ban className="mr-2" />
             {isPending ? "Blacklisting..." : "Blacklist IP"}
          </Button>
           {record.hwid && (
            <Button variant="destructive" onClick={() => handleBlacklist('hwid', record.hwid)} disabled={isPending || isHwidBlacklisted}>
                <Ban className="mr-2" />
                {isPending ? "Blacklisting..." : "Blacklist HWID"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
