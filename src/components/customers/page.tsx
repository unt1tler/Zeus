

import { getLicenses, getAllUsers } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Crown, Mail, User as UserIcon } from "lucide-react";
import type { Customer } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { CustomersClient } from "./CustomersClient";


export default async function CustomersPage() {
  const customers = await getAllUsers();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Customers"
        description="An overview of all your license holders and sub-users."
      />
      <CustomersClient customers={customers} />
    </div>
  );
}

    
