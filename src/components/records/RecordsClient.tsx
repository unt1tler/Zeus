
"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { EnrichedValidationLog } from "@/app/(dashboard)/records/page";
import type { License, Blacklist } from "@/lib/types";
import { simulateValidationRequest } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import { RecordDetailsDialog } from "./RecordDetailsDialog";
import { LicenseDetailsDialog } from "../licenses/LicenseDetailsDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type FilterOption = "licenseKey" | "customer" | "ipAddress" | "status";

export function RecordsClient({ logs, licenses, blacklist }: { logs: EnrichedValidationLog[], licenses: License[], blacklist: Blacklist }) {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedRecord, setSelectedRecord] = React.useState<EnrichedValidationLog | null>(null);
  const [selectedLicense, setSelectedLicense] = React.useState<License & { productName: string } | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterBy, setFilterBy] = React.useState<FilterOption>("licenseKey");

  React.useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [router]);

  const filteredLogs = React.useMemo(() => {
    if (!searchTerm) return logs;
    const lowercasedSearchTerm = searchTerm.toLowerCase();

    return logs.filter(log => {
        switch (filterBy) {
            case 'customer':
                const username = log.customerUsername?.toLowerCase() || '';
                const discordId = log.discordId.toLowerCase();
                return username.includes(lowercasedSearchTerm) || discordId.includes(lowercasedSearchTerm);
            case 'ipAddress':
                return log.ipAddress.toLowerCase().includes(lowercasedSearchTerm);
            case 'status':
                return log.status.toLowerCase().includes(lowercasedSearchTerm);
            case 'licenseKey':
            default:
                return log.licenseKey.toLowerCase().includes(lowercasedSearchTerm);
        }
    })
  }, [logs, searchTerm, filterBy]);


  const handleSimulate = async (status: 'success' | 'failure') => {
    await simulateValidationRequest(status);
    toast({
      title: "Simulation Sent",
      description: `A ${status} validation request has been simulated.`,
    });
    router.refresh();
  };

  const handleRowClick = (record: EnrichedValidationLog) => {
    setSelectedRecord(record);
  };
  
  const handleLicenseClick = (key: string) => {
    const license = licenses.find(l => l.key === key);
    if(license) {
        // Since we don't have product data directly here, we might need a way to get it
        // Or we pass all licenses with product names to the client
        const products = licenses.map(l => ({ id: l.productId, name: (l as any).productName || 'Unknown'}));
        const product = products.find(p => p.id === license.productId);
        setSelectedLicense({...license, productName: product?.name || "N/A" });
    }
  }

  const handleDialogClose = () => {
    setSelectedRecord(null);
    setSelectedLicense(null);
  };
  
  const getPlaceholder = () => {
    switch (filterBy) {
      case 'licenseKey': return 'Search by license key...';
      case 'customer': return 'Search by Discord ID or username...';
      case 'ipAddress': return 'Search by IP address...';
      case 'status': return 'Search by status (success, failure)...';
      default: return 'Search...';
    }
  }

  return (
    <>
       <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Label htmlFor="filter-by">Filter Records</Label>
              <div className="flex items-center gap-2">
                <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                    <SelectTrigger id="filter-by" className="w-[180px]">
                        <SelectValue placeholder="Filter by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="licenseKey">License Key</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="ipAddress">IP Address</SelectItem>
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
            <div className="flex w-full items-end gap-2">
              <Button variant="outline" className="w-full" onClick={() => handleSimulate('success')}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Simulate Success
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => handleSimulate('failure')}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Simulate Failure
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      <DataTable
        columns={columns({ onLicenseClick: handleLicenseClick })}
        data={filteredLogs}
        filterColumn="licenseKey" // This is now handled by our custom search
        filterPlaceholder="Filter by license key..."
        onRowClick={handleRowClick}
        hideDefaultFilter
      />
      
      {selectedRecord && (
        <RecordDetailsDialog
          record={selectedRecord}
          licenses={licenses}
          blacklist={blacklist}
          isOpen={!!selectedRecord}
          onClose={handleDialogClose}
          onLicenseClick={handleLicenseClick}
        />
      )}
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
