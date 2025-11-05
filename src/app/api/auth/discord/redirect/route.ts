
import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data';

export async function GET() {
  const settings = await getSettings();
  const { clientId } = settings.discordBot;

  if (!clientId) {
    return NextResponse.json(
      { error: "Discord Client ID is not configured." },
      { status: 500 }
    );
  }

  const redirectUri = `${settings.panelUrl}/api/auth/discord/callback`;
  const scope = "identify email";
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(authUrl);
}
