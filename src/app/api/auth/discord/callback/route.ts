import { getSettings, getBlacklist } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import type { ClientUser } from "@/lib/types";
import {
  CLIENT_USER_COOKIE,
  createClientUserCookieValue,
  DISCORD_OAUTH_STATE_COOKIE,
  timingSafeCompare,
  verifyDiscordOAuthStateCookie,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const fallbackBaseUrl = new URL(request.url);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=NoCode", request.url));
  }

  const settings = await getSettings();
  const { clientId, botSecret: clientSecret } = settings.discordBot;
  const baseUrl = settings.panelUrl || fallbackBaseUrl.origin;
  const redirectUri = `${settings.panelUrl}/api/auth/discord/callback`;

  const storedStateCookie = request.cookies.get(DISCORD_OAUTH_STATE_COOKIE)?.value;
  const storedState = storedStateCookie ? verifyDiscordOAuthStateCookie(storedStateCookie) : null;

  if (!state || !storedState || !timingSafeCompare(state, storedState.state)) {
    const invalidStateResponse = NextResponse.redirect(new URL("/login?error=InvalidState", baseUrl));
    invalidStateResponse.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    return invalidStateResponse;
  }

  if (!settings.panelUrl || !clientId || !clientSecret || !process.env.SESSION_SECRET) {
    const response = NextResponse.redirect(new URL("/login?error=ConfigError", baseUrl));
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    return response;
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL("/login?error=TokenError", baseUrl));
    }

    const { access_token, token_type } = await tokenResponse.json();

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `${token_type} ${access_token}` },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(new URL("/login?error=UserError", baseUrl));
    }

    const discordUser: any = await userResponse.json();

    const blacklist = await getBlacklist();
    if (blacklist.discordIds.includes(discordUser.id)) {
      return NextResponse.redirect(new URL("/login?error=AccessDenied", baseUrl));
    }

    const user: ClientUser = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
      email: discordUser.email || undefined,
    };

    if (user.email) {
      const { updateLicenses } = await import("@/lib/data");
      await updateLicenses(licenses => {
        let modified = false;
        for (const license of licenses) {
          if (license.discordId === user.id && !license.email) {
            license.email = user.email;
            license.updatedAt = new Date().toISOString();
            modified = true;
          }
        }
        return licenses;
      });
    }

    const signedValue = createClientUserCookieValue(user);
    if (!signedValue) {
      const response = NextResponse.redirect(new URL("/login?error=ConfigError", baseUrl));
      response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
      return response;
    }

    const clientUrl = new URL("/client", baseUrl);
    const response = NextResponse.redirect(clientUrl);
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);

    response.cookies.set({
      name: CLIENT_USER_COOKIE,
      value: signedValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;

  } catch (error) {
    const response = NextResponse.redirect(new URL("/login?error=CallbackFailed", baseUrl));
    response.cookies.delete(DISCORD_OAUTH_STATE_COOKIE);
    return response;
  }
}
