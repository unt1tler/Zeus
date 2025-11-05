
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { EnrichedValidationLog } from "@/app/(dashboard)/records/page";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface ColumnsOptions {
    onLicenseClick: (licenseKey: string) => void;
}

export const columns = ({ onLicenseClick }: ColumnsOptions): ColumnDef<EnrichedValidationLog>[] => [
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as string;
      return format(new Date(timestamp), "HH:mm:ss");
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={status === "success" ? "success" : "destructive"}>
          {status}
        </Badge>
      );
    },
  },
  {
    id: 'customer',
    header: "Customer",
    cell: ({ row }) => {
        const record = row.original;
        const customerName = record.customerUsername || record.discordId;
         if (record.discordId === 'N/A') {
            return <span>N/A</span>;
        }
        return (
             <Link href={`/customers/${record.discordId}`} className="inline-flex items-center gap-1 hover:underline" onClick={(e) => e.stopPropagation()}>
                {customerName}
                <ExternalLink className="h-3 w-3" />
             </Link>
        )
    }
  },
  {
    accessorKey: "licenseKey",
    header: "License Key",
    cell: ({ row }) => {
      const key = row.getValue("licenseKey") as string;
      return (
          <button 
            className="p-0 h-auto font-mono text-xs hover:underline disabled:no-underline disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={(e) => {
                e.stopPropagation();
                onLicenseClick(key)
            }}
            disabled={key === 'N/A'}
          >
            {key.substring(0, 12)}...
          </button>
      )
    }
  },
  {
    accessorKey: "productName",
    header: "Product"
  },
  {
    accessorKey: "ipAddress",
    header: "IP Address",
  },
  {
    accessorKey: "reason",
    header: "Reason",
    cell: ({ row }) => {
        const reason = row.getValue("reason") as string | undefined;
        return reason || 'N/A'
    }
  },
];
