
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Puzzle, Store } from "lucide-react";

export function IntegrationNav() {
    const pathname = usePathname();
    const isIntegrationPage = pathname === "/integration";
    const isAppCreationPage = pathname === "/integration/app-creation";
    const isBuiltByBitPage = pathname === "/integration/builtbybit";
    const isBuiltByBitWebhookPage = pathname === "/integration/builtbybit/webhook";
    
    return (
        <nav className="flex flex-col p-2 rounded-md border">
            <Accordion type="single" collapsible defaultValue="product-integration" className="w-full">
                <AccordionItem value="product-integration" className="border-b-0">
                    <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline hover:bg-accent rounded-md">
                       <div className="flex items-center gap-2">
                            <Puzzle className="h-4 w-4" />
                            <span>Product Integration</span>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1">
                        <div className="flex flex-col space-y-1 pl-6 border-l ml-3">
                            <Link
                                href="/integration"
                                className={cn(
                                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                    isIntegrationPage ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                Validation API
                            </Link>
                             <Link
                                href="/integration/app-creation"
                                className={cn(
                                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                     isAppCreationPage ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                App Creation
                            </Link>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="builtbybit-integration" className="border-b-0">
                    <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline hover:bg-accent rounded-md">
                         <div className="flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            <span>BuiltByBit</span>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1">
                         <div className="flex flex-col space-y-1 pl-6 border-l ml-3">
                             <Link
                                href="/integration/builtbybit"
                                className={cn(
                                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                     isBuiltByBitPage ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                Placeholder Automation
                            </Link>
                            <Link
                                href="/integration/builtbybit/webhook"
                                className={cn(
                                    "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                     isBuiltByBitWebhookPage ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                Purchase Webhook
                            </Link>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </nav>
    );
}
