
"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ textToCopy, className }: { textToCopy: string, className?: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        toast({ title: "Copied!", description: "The content has been copied to your clipboard." });
    };

    return (
        <Button variant="ghost" size="icon" onClick={handleCopy} className={cn("h-8 w-8", className)}>
            <Copy className="h-4 w-4" />
        </Button>
    )
}
