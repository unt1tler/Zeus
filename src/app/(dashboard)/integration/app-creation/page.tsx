
import { PageHeader } from "@/components/PageHeader";
import { getSettings } from "@/lib/data";
import { ProductIntegrationClient } from "@/components/integration/ProductIntegrationClient";
import { IntegrationNav } from "../IntegrationNav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/integration/CodeBlock";
import Link from "next/link";
import type { Settings } from "@/lib/types";

function getSuccessResponseExample(settings: Settings) {
    const vs = settings.validationResponse;
    const example: any = { success: true, status: "success" };

    if (vs.customSuccessMessage.enabled) {
        example.message = vs.customSuccessMessage.message || "License key is valid";
    }

    if (vs.license.enabled) {
        example.license = {};
        if(vs.license.fields.license_key) example.license.license_key = "LF-...";
        if(vs.license.fields.status) example.license.status = "active";
        if(vs.license.fields.expires_at) example.license.expires_at = "2025-12-31T23:59:59Z";
        if(vs.license.fields.issue_date) example.license.issue_date = "2024-01-01T00:00:00Z";
        if(vs.license.fields.max_ips) example.license.max_ips = 1;
        if(vs.license.fields.used_ips) example.license.used_ips = ["127.0.0.1"];
        if (Object.keys(example.license).length === 0) delete example.license;
    }
    if (vs.customer.enabled) {
        example.customer = {};
        if(vs.customer.fields.id) example.customer.id = "123456789012345678";
        if(vs.customer.fields.discord_id) example.customer.discord_id = "123456789012345678";
        if(vs.customer.fields.customer_since) example.customer.customer_since = "2024-01-01T00:00:00Z";
        if (Object.keys(example.customer).length === 0) delete example.customer;
    }
     if (vs.product.enabled) {
        example.product = {};
        if(vs.product.fields.id) example.product.id = "prod_...";
        if(vs.product.fields.name) example.product.name = "My Awesome App";
        if(vs.product.fields.enabled) example.product.enabled = true;
        if (Object.keys(example.product).length === 0) delete example.product;
    }
    
    return JSON.stringify(example, null, 2);
}


export default async function AppCreationPage() {
  const settings = await getSettings();
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12 items-start">
        <div className="lg:col-span-1 space-y-8">
            <ProductIntegrationClient panelUrl={settings.panelUrl} />
            <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Protect Your Code!</AlertTitle>
                <AlertDescription>
                    For protecting your application's source code, consider using a code obfuscator. A popular choice is <a href="https://obfuscator.io/" target="_blank" rel="noopener noreferrer" className="font-bold underline">obfuscator.io</a> for JavaScript/Node.js applications.
                </AlertDescription>
            </Alert>
            <Card>
                <CardHeader>
                    <CardTitle>API Response Structure</CardTitle>
                    <CardDescription>
                        A successful validation will return a JSON object. The exact fields depend on your settings in the <Link href="/integration" className="font-bold underline">Validation API</Link> tab. Below is an example of a success response based on your current settings.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodeBlock language="json" code={getSuccessResponseExample(settings)} />
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 sticky top-8">
            <IntegrationNav />
        </div>
    </div>
  );
}
