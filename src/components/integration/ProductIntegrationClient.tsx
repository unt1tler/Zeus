
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/integration/CodeBlock";
import { getJavaWrapper, getNodeJsWrapper, getPythonWrapper } from "@/lib/integration-code";
import { Card } from "../ui/card";
import { NodeIcon, JavaIcon, PythonIcon } from "../icons";

interface ProductIntegrationClientProps {
    panelUrl: string;
}

export function ProductIntegrationClient({ panelUrl }: ProductIntegration_ClientProps) {
    const [activeTab, setActiveTab] = useState("nodejs");

    const endpoint = panelUrl ? `${panelUrl}/api/validate` : `https://<YOUR_APP_URL>/api/validate`;
    
    const getCode = (lang: string) => {
        let code = '';
        if (lang === 'nodejs') code = getNodeJsWrapper();
        else if (lang === 'java') code = getJavaWrapper();
        else if (lang === 'python') code = getPythonWrapper();
        
        return code.replace(/https?:\/\/<YOUR_APP_URL>\/api\/validate/g, endpoint);
    };

    return (
        <div className="space-y-8">
            <Card className="bg-card/50 p-6 sm:p-8 space-y-8">
                <div className="space-y-2">
                     <h2 className="text-2xl font-bold tracking-tight">Integrate into your product</h2>
                    <p className="text-muted-foreground max-w-2xl">
                       We've made it dead simple to integrate into your product - no libraries required. The request should be sent with a JSON body.
                    </p>
                </div>
                 <div className="flex items-center gap-4 rounded-md">
                    <span className="text-sm font-semibold bg-primary text-primary-foreground px-2 py-1 rounded-md">POST</span>
                    <p className="font-mono text-sm text-muted-foreground">{endpoint}</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg">Request Body</h3>
                        <div className="text-sm space-y-6 rounded-lg border p-4 bg-background/30">
                            <div>
                                <p className="font-mono font-semibold">key</p>
                                <p className="text-muted-foreground text-xs">The license key for the product. <span className="text-orange-400">(Required)</span></p>
                            </div>
                            <div>
                                <p className="font-mono font-semibold">discordId</p>
                                <p className="text-muted-foreground text-xs">The user's Discord ID. <span className="text-orange-400">(Required if enabled in settings)</span></p>
                            </div>
                            <div>
                                <p className="font-mono font-semibold">hwid</p>
                                <p className="text-muted-foreground text-xs">The user's unique hardware ID. <span className="text-orange-400">(Required if product has HWID protection)</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 justify-start h-auto">
                                <TabsTrigger value="nodejs" className="data-[state=active]:bg-accent/50 data-[state=active]:shadow-none data-[state=active]:text-primary-foreground justify-start rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary mr-2">
                                   <NodeIcon className="mr-2"/> Node.js
                                </TabsTrigger>
                                <TabsTrigger value="java" className="data-[state=active]:bg-accent/50 data-[state=active]:shadow-none data-[state=active]:text-primary-foreground justify-start rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary mr-2">
                                   <JavaIcon className="mr-2"/> Java
                                </TabsTrigger>
                                <TabsTrigger value="python" className="data-[state=active]:bg-accent/50 data-[state=active]:shadow-none data-[state=active]:text-primary-foreground justify-start rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
                                    <PythonIcon className="mr-2"/> Python
                                </TabsTrigger>
                            </TabsList>
                            <div className="mt-[-1px] rounded-b-md bg-muted/30">
                                <TabsContent value="nodejs" className="mt-0">
                                    <CodeBlock code={getCode('nodejs')} language="javascript" />
                                </TabsContent>
                                <TabsContent value="java" className="mt-0">
                                    <CodeBlock code={getCode('java')} language="java" />
                                </TabsContent>
                                <TabsContent value="python" className="mt-0">
                                    <CodeBlock code={getCode('python')} language="python" />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </Card>
        </div>
    );
}
