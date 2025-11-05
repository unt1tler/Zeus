"use server"

import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { ClientLayoutClient } from '@/components/client/ClientLayout';
import { getSettings } from "@/lib/data";
import Link from "next/link";

async function handleLogout() {
  'use server';
  cookies().delete('user');
  redirect('/login');
}

export default async function ClientPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const userCookie = cookieStore.get('user');

  if (!userCookie?.value) {
    redirect('/login');
  }
  
  const settings = await getSettings();
  if (!settings.clientPanel?.enabled) {
    notFound();
  }
  
  return (
    <ClientLayoutClient accentColor={settings.clientPanel.accentColor}>
       <header className="absolute top-0 right-0 p-4 z-20">
          <form action={handleLogout}>
              <Button type="submit" variant="ghost" className="text-white bg-black/20 hover:bg-white/10 hover:text-white">
                  <LogOut className="mr-2" /> Logout
              </Button>
          </form>
       </header>
       <main className="relative z-10 w-full min-h-screen flex items-center justify-center p-4">
          {children}
      </main>
    </ClientLayoutClient>
  );
}
