
import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data';
import {
  createDiscordOAuthState,
  DISCORD_OAUTH_STATE_COOKIE,
  getDiscordOAuthStateMaxAge,
  shouldUseSecureCookies,
} from '@/lib/auth';

export async function GET() {
  const settings = await getSettings();
  const { clientId } = settings.discordBot;

  if (!settings.clientPanel?.enabled || !clientId || !settings.panelUrl) {
    return NextResponse.json(
      { error: "Discord OAuth is not configured." },
      { status: 500 }
    );
  }

  const { state, cookieValue } = createDiscordOAuthState();
  if (!cookieValue) {
    return NextResponse.json(
      { error: "SESSION_SECRET is not configured." },
      { status: 500 }
    );
  }

  const redirectUri = `${settings.panelUrl}/api/auth/discord/callback`;
  const scope = "identify email";
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: DISCORD_OAUTH_STATE_COOKIE,
    value: cookieValue,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'lax',
    maxAge: getDiscordOAuthStateMaxAge(),
    path: '/',
  });

  return response;
}
