
import { DiscordLoginIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSettings } from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginClient } from "./LoginClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const cookieStore = cookies();
  const userCookie = cookieStore.get('user');
  
  if (userCookie) {
    redirect('/client');
  }
  
  const settings = await getSettings();
  const accentColor = settings.clientPanel?.accentColor || '#5865F2';


  if (!settings.clientPanel?.enabled) {
    notFound();
  }
  
  const error = searchParams.error;
  let errorMessage: string | null = null;
  if (error === 'AccessDenied') {
      errorMessage = 'Your account has been blacklisted. Access denied.';
  } else if (error) {
      errorMessage = 'An unknown error occurred during authentication. Please try again.';
  }


  return (
    <LoginClient accentColor={accentColor}>
      <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-8 text-center shadow-2xl backdrop-blur-lg">
        <h1 className="mb-4 text-3xl font-bold text-white">
          Client Dashboard
        </h1>
        <p className="mb-8 text-neutral-300">
          Authorize with Discord to continue and manage your licenses.
        </p>
        
        {errorMessage && (
            <Alert variant="destructive" className="mb-6 text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
        )}

        <Button asChild className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4]">
          <Link href="/api/auth/discord/redirect">
            <DiscordLoginIcon className="mr-2 h-5 w-5" />
            Authorize with Discord
          </Link>
        </Button>
      </div>
    </LoginClient>
  );
}
