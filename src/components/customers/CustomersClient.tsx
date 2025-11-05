
"use client";

import { useState, useMemo } from "react";
import type { Customer } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Crown, Mail, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DiscordIcon } from "../icons";

type FilterOption = "username" | "email" | "role" | "builtByBitId";

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>("username");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "member">(
    "all"
  );

  const filteredCustomers = useMemo(() => {
    let results = customers;

    if (roleFilter !== "all") {
      results = results.filter((customer) => {
        if (roleFilter === "owner") return customer.isOwner;
        if (roleFilter === "member")
          return !customer.isOwner && customer.subUserLicenseCount > 0;
        return true;
      });
    }

    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      results = results.filter((customer) => {
        switch (filterBy) {
          case "username":
            const username = customer.discordUsername?.toLowerCase() || "";
            const discordId = customer.discordId.toLowerCase();
            return (
              username.includes(lowercasedSearchTerm) ||
              discordId.includes(lowercasedSearchTerm)
            );
          case "email":
            return (
              customer.email?.toLowerCase().includes(lowercasedSearchTerm) || false
            );
          case "builtByBitId":
            return (
              customer.builtByBitId?.toLowerCase().includes(lowercasedSearchTerm) || false
            );
          default:
            return true;
        }
      });
    }

    return results;
  }, [customers, searchTerm, filterBy, roleFilter]);
  
  const handleFilterChange = (value: string) => {
    if (value === "owner" || value === "member") {
      setFilterBy("role");
      setRoleFilter(value as "owner" | "member");
      setSearchTerm(""); // Clear search term when switching to a role filter
    } else {
      setFilterBy(value as FilterOption);
      setRoleFilter("all");
    }
  };

  const getPlaceholder = () => {
    switch(filterBy) {
      case 'username': return 'Search by username or ID...';
      case 'email': return 'Search by email...';
      case 'builtByBitId': return 'Search by BuiltByBit ID...';
      case 'role': return 'Filtering by role...';
      default: return 'Search...';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
             <div className="md:col-span-3">
                <Label htmlFor="filter-by">Search & Filter</Label>
                <div className="flex items-center gap-2">
                    <Select onValueChange={handleFilterChange} defaultValue="username">
                        <SelectTrigger id="filter-by" className="w-[180px]">
                            <SelectValue placeholder="Filter by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="username">Username/ID</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="builtByBitId">BuiltByBit ID</SelectItem>
                            <SelectItem value="owner">Owners</SelectItem>
                            <SelectItem value="member">Members</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        id="search"
                        placeholder={getPlaceholder()}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1"
                        disabled={filterBy === 'role'}
                    />
                </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <Card key={customer.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={customer.avatarUrl}
                        alt={customer.discordUsername || customer.discordId}
                      />
                      <AvatarFallback>
                        <UserIcon />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {customer.discordUsername || customer.discordId}
                      </CardTitle>
                      <CardDescription>
                        {customer.isOwner ? `Owner` : `Member`}
                      </CardDescription>
                    </div>
                  </div>
                  {customer.isOwner && (
                    <Crown className="h-5 w-5 text-yellow-500" title="Owner" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <DiscordIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Discord:</span>
                    <span className="truncate">{customer.discordId}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email:</span>
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                    Summary
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center justify-between">
                      <span>Owned Licenses:</span>{" "}
                      <span className="font-medium text-foreground">
                        {customer.ownedLicenseCount}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Member On:</span>{" "}
                      <span className="font-medium text-foreground">
                        {customer.subUserLicenseCount}
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <Link
                  href={`/customers/${customer.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full"
                  )}
                >
                  View Profile
                </Link>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-10 text-center">
            <p className="text-muted-foreground">No customers found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
