
"use client";

import { useState, useMemo, useTransition } from "react";
import type { ClientUser, License, Product, Customer } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  KeyRound,
  User,
  Mail,
  InfinityIcon,
  Trash2,
  Plus,
  RotateCcw,
  Search,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { updateClientLicense } from "@/lib/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";

interface EnrichedLicense extends License {
  productName: string;
  productImageUrl: string;
  isOwner: boolean;
}

function ManageLicenseDialog({
  license,
  product,
  isOpen,
  onClose,
}: {
  license: EnrichedLicense;
  product: Product | undefined;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [ips, setIps] = useState([...license.allowedIps]);
  const [hwids, setHwids] = useState([...license.allowedHwids]);
  const [newIp, setNewIp] = useState("");
  const [newHwid, setNewHwid] = useState("");

  const handleIpAdd = () => {
    if (!newIp.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
      toast({
        variant: "destructive",
        title: "Invalid IP",
        description: "Please enter a valid IP address.",
      });
      return;
    }
    if (license.maxIps > 0 && ips.length >= license.maxIps) {
      toast({
        variant: "destructive",
        title: "Limit Reached",
        description: "You have reached the maximum number of IPs for this license.",
      });
      return;
    }
    if (!ips.includes(newIp)) {
      setIps([...ips, newIp]);
    }
    setNewIp("");
  };
  
  const handleHwidAdd = () => {
    if (!newHwid) return;
     if (product?.hwidProtection && license.maxHwids > 0 && hwids.length >= license.maxHwids) {
      toast({
        variant: "destructive",
        title: "Limit Reached",
        description: "You have reached the maximum number of HWIDs for this license.",
      });
      return;
    }
    if (!hwids.includes(newHwid)) {
      setHwids([...hwids, newHwid]);
    }
    setNewHwid("");
  }
  
  const handleReset = () => {
    setIps([]);
    setHwids([]);
    toast({ title: "Reset", description: "IPs and HWIDs have been cleared. Click 'Save Changes' to confirm."})
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateClientLicense(license.key, ips, hwids);
      if (result.success) {
        toast({ title: "Success", description: "License updated successfully." });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message || "Failed to update license.",
        });
      }
    });
  };
  
   const InfoRow = ({ label, value }: { label: string, value: string | React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm py-2">
      <span className="text-neutral-400">{label}</span>
      <span className="font-mono text-white text-right">{value}</span>
    </div>
  );

  const ipProtectionDisabled = license.maxIps === -2;
  const hwidProtectionDisabled = !product?.hwidProtection;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-neutral-900/80 text-white border-neutral-700 backdrop-blur-md p-8 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>Manage License: {license.productName}</DialogTitle>
          <p className="text-sm text-neutral-400 font-mono pt-1">
            {license.key}
          </p>
        </DialogHeader>

        <hr className="border-neutral-700 my-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
             <InfoRow label="Issued" value={format(new Date(license.createdAt), "MMMM do, yyyy")} />
             <InfoRow label="Expires" value={license.expiresAt ? format(new Date(license.expiresAt), "MMMM do, yyyy") : "Never"} />
             <InfoRow label="BuiltByBit ID" value={product?.builtByBitResourceId || "N/A"} />
             <InfoRow 
                label="IP Protection" 
                value={ipProtectionDisabled ? "Disabled" : `${ips.length} / ${license.maxIps === -1 ? '∞' : license.maxIps}`} 
             />
             <InfoRow 
                label="HWID Protection" 
                value={hwidProtectionDisabled ? "Disabled" : `${hwids.length} / ${license.maxHwids === -1 ? '∞' : license.maxHwids}`}
             />
          </div>

          <div className="space-y-6">
            {ipProtectionDisabled && hwidProtectionDisabled ? (
                <div className="flex items-center justify-center h-full text-center text-neutral-400 text-sm">
                    Any IP and HWID can access this license.
                </div>
            ) : (
                <>
                    {ipProtectionDisabled ? (
                        <div className="text-neutral-400 text-sm">Any IP can access this license.</div>
                    ) : (
                        <div className="space-y-3">
                        <label className="text-sm font-medium">Allowed IPs</label>
                        <div className="flex gap-2">
                            <Input
                            value={newIp}
                            onChange={(e) => setNewIp(e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="Add new IP"
                            className="bg-neutral-800 border-neutral-700 focus:ring-offset-0 focus:ring-2 focus-visible:ring-[var(--ring)]"
                            />
                            <Button onClick={handleIpAdd} size="icon" style={{ backgroundColor: 'var(--accent-color)' }} className="text-white hover:opacity-90"><Plus className="h-4 w-4"/></Button>
                        </div>
                        <div className="space-y-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                            {ips.map((ip) => (
                            <div key={ip} className="flex items-center justify-between text-sm bg-black/20 p-2 rounded-md">
                                <span className="font-mono">{ip}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => setIps(ips.filter(i => i !== ip))}>
                                <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            ))}
                        </div>
                        </div>
                    )}
                    
                    {hwidProtectionDisabled ? (
                         <div className="text-neutral-400 text-sm">Any HWID can access this license.</div>
                    ) : (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Allowed HWIDs</label>
                            <div className="flex gap-2">
                                <Input 
                                value={newHwid} 
                                onChange={(e) => setNewHwid(e.target.value)} 
                                placeholder="Add new HWID" 
                                className="bg-neutral-800 border-neutral-700 focus:ring-offset-0 focus:ring-2 focus-visible:ring-[var(--ring)]"
                                />
                                <Button onClick={handleHwidAdd} size="icon" style={{ backgroundColor: 'var(--accent-color)' }} className="text-white hover:opacity-90"><Plus className="h-4 w-4"/></Button>
                            </div>
                            <div className="space-y-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                {hwids.map((hwid) => (
                                <div key={hwid} className="flex items-center justify-between text-sm bg-black/20 p-2 rounded-md">
                                    <span className="font-mono truncate">{hwid}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => setHwids(hwids.filter(h => h !== hwid))}>
                                    <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-6">
            {(!ipProtectionDisabled || !hwidProtectionDisabled) ? (
                <Button variant="destructive" onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4"/> Reset</Button>
            ) : ( <div></div> )}
            <div className="flex gap-2">
                <Button onClick={onClose} variant="secondary" className="bg-neutral-700 hover:bg-neutral-600 text-white">Cancel</Button>
                <Button onClick={handleSave} disabled={isPending} style={{ backgroundColor: 'var(--accent-color)' }} className="text-white hover:opacity-90">
                    {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LicenseManagementClientProps {
  licenses: EnrichedLicense[];
  products: Product[];
  user: ClientUser;
  userProfile?: Customer;
  ipUsage: { used: number; total: number };
}

type FilterType = "productName" | "key" | "expiresAt" | "createdAt" | "builtByBitResourceId";


export function LicenseManagementClient({
  licenses,
  products,
  user,
  userProfile,
  ipUsage,
}: LicenseManagementClientProps) {
  const [filter, setFilter] = useState({ term: "", type: "productName" as FilterType });
  const [selectedLicense, setSelectedLicense] = useState<EnrichedLicense | null>(null);

  const filteredLicenses = useMemo(() => {
    if (!filter.term) return licenses;
    const term = filter.term.toLowerCase();
    
    return licenses.filter((l) => {
        const product = getProductById(l.productId);
        switch(filter.type) {
            case "productName":
                return l.productName.toLowerCase().includes(term);
            case "key":
                return l.key.toLowerCase().includes(term);
            case "expiresAt":
                const expiry = l.expiresAt ? format(new Date(l.expiresAt), "PPP").toLowerCase() : "never";
                return expiry.includes(term);
            case "createdAt":
                const created = format(new Date(l.createdAt), "PPP").toLowerCase();
                return created.includes(term);
            case "builtByBitResourceId":
                return product?.builtByBitResourceId?.toLowerCase().includes(term) ?? false;
            default:
                return true;
        }
    });
  }, [licenses, filter]);
  
  const getProductById = (id: string) => products.find(p => p.id === id);


  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 text-white">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-start">
        <div
          className="md:col-span-2 p-12 rounded-2xl flex items-center"
          style={{ backgroundColor: 'var(--accent-color)' }}
        >
            <div className="flex items-center gap-6">
                <Avatar className="h-28 w-28 border-4 border-white/20">
                <AvatarImage src={user.avatar} alt={user.username} />
                <AvatarFallback className="text-black text-5xl">{user.username.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-3">
                <h1 className="text-4xl font-bold">{user.username}</h1>
                <div className="flex items-center gap-2 text-sm opacity-80">
                    <User className="h-4 w-4"/>
                    <span className="font-mono">{user.id}</span>
                </div>
                {user.email && (
                    <div className="flex items-center gap-2 text-sm opacity-80">
                        <Mail className="h-4 w-4"/>
                        <span>{user.email}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 text-sm opacity-80">
                    <Image src="https://i.ibb.co/k6g8z6LT/images-1-removebg-preview.png" alt="BuiltByBit" width={16} height={16} />
                    <span>BuiltByBit:</span>
                    <span className="font-mono">{userProfile?.builtByBitId || 'N/A'}</span>
                </div>
                </div>
            </div>
        </div>

        <div className="space-y-12">
          <Card className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
              <h3 className="text-sm font-medium">
                Total Licenses
              </h3>
              <KeyRound className="h-5 w-5 text-neutral-300" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-2xl font-bold">{licenses.length}</div>
            </CardContent>
          </Card>
          <Card className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
              <h3 className="text-sm font-medium">IP Usage</h3>
              <User className="h-5 w-5 text-neutral-300" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-2xl font-bold">
                {ipUsage.used} /{" "}
                {ipUsage.total === Infinity ? (
                  <InfinityIcon className="inline h-6 w-6" />
                ) : (
                  ipUsage.total
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="mb-6 space-y-2">
        <Label>Search & Filter Licenses</Label>
        <div className="flex items-center gap-2">
             <Select value={filter.type} onValueChange={(value) => setFilter({ ...filter, type: value as FilterType })}>
                <SelectTrigger className="w-[180px] bg-neutral-800 border-neutral-700">
                    <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 text-white border-neutral-700">
                    <SelectItem value="productName">Product Name</SelectItem>
                    <SelectItem value="key">License Key</SelectItem>
                    <SelectItem value="expiresAt">Expiry Date</SelectItem>
                    <SelectItem value="createdAt">Issue Date</SelectItem>
                    <SelectItem value="builtByBitResourceId">BuiltByBit ID</SelectItem>
                </SelectContent>
            </Select>
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
                <Input 
                  placeholder="Search your licenses..." 
                  value={filter.term} 
                  onChange={(e) => setFilter({...filter, term: e.target.value})} 
                  className="bg-neutral-800 border-neutral-700 pl-10"
                />
            </div>
        </div>
      </div>

        {filteredLicenses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLicenses.map((license) => {
              const isExpired = license.status !== 'active' || (license.expiresAt && new Date(license.expiresAt) < new Date());
              return (
                 <Card
                  key={license.key}
                  className="bg-white/10 border border-white/20 backdrop-blur-lg flex flex-col rounded-2xl overflow-hidden"
                >
                  <div className="relative w-full aspect-[16/9]">
                    <Image
                      src={license.productImageUrl}
                      alt={license.productName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold">{license.productName}</h3>
                    <p className="font-mono text-xs text-neutral-400 pt-1">{license.key}</p>
                    
                    <div className="flex-1 my-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Expires:</span>
                        <span>{license.expiresAt ? format(new Date(license.expiresAt), "PPP") : "Never"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">IPs:</span>
                        <span>{license.maxIps === -2 ? "N/A" : `${license.allowedIps.length}/${license.maxIps === -1 ? '∞' : license.maxIps}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">HWIDs:</span>
                        <span>
                          {getProductById(license.productId)?.hwidProtection
                            ? `${license.allowedHwids.length}/${license.maxHwids === -1 ? '∞' : license.maxHwids}`
                            : "N/A"
                          }
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                       {isExpired ? (
                        <Button
                          disabled
                          className="w-full bg-neutral-700/50 text-neutral-400 cursor-not-allowed hover:bg-neutral-700/50"
                        >
                          EXPIRED
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setSelectedLicense(license)}
                          className="w-full text-white hover:opacity-90"
                          style={{ backgroundColor: 'var(--accent-color)' }}
                        >
                          Manage License
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
            <div className="text-center py-16 bg-white/5 rounded-lg">
                <Package className="mx-auto h-12 w-12 text-neutral-500" />
                <h3 className="mt-4 text-lg font-semibold">No Licenses Found</h3>
                <p className="mt-2 text-neutral-400">You do not have any licenses that match your search.</p>
            </div>
        )}

      {selectedLicense && (
        <ManageLicenseDialog
          license={selectedLicense}
          product={getProductById(selectedLicense.productId)}
          isOpen={!!selectedLicense}
          onClose={() => setSelectedLicense(null)}
        />
      )}
    </div>
  );
}
