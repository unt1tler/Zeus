
import { getSettings, saveLicenses, getLicenses, getBlacklist } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import type { ClientUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=NoCode", request.url));
  }

  const settings = await getSettings();
  const { clientId, botSecret: clientSecret } = settings.discordBot;
  const redirectUri = `${settings.panelUrl}/api/auth/discord/callback`;

  if (!clientId || !clientSecret) {
    console.error("Discord client ID or secret is not configured.");
    return NextResponse.redirect(new URL("/login?error=ConfigError", settings.panelUrl));
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error("Failed to fetch Discord token:", error);
      return NextResponse.redirect(
        new URL("/login?error=TokenError", settings.panelUrl)
      );
    }

    const { access_token, token_type } = await tokenResponse.json();

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        authorization: `${token_type} ${access_token}`,
      },
    });

    if (!userResponse.ok) {
        console.error("Failed to fetch Discord user:", await userResponse.json());
      return NextResponse.redirect(
        new URL("/login?error=UserError", settings.panelUrl)
      );
    }

    const discordUser: any = await userResponse.json();

    // Check if the user is blacklisted
    const blacklist = await getBlacklist();
    if (blacklist.discordIds.includes(discordUser.id)) {
        return NextResponse.redirect(new URL("/login?error=AccessDenied", settings.panelUrl));
    }

    const user: ClientUser = {
        id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
        email: discordUser.email || undefined,
    }

    // Update email for existing licenses
    if (user.email) {
        const licenses = await getLicenses();
        let licensesUpdated = false;
        licenses.forEach(license => {
            if (license.discordId === user.id && !license.email) {
                license.email = user.email;
                license.updatedAt = new Date().toISOString();
                licensesUpdated = true;
            }
        });

        if (licensesUpdated) {
            await saveLicenses(licenses);
        }
    }
    
    // Redirect to the client page and set the cookie in the same response
    const clientUrl = new URL("/client", settings.panelUrl);
    const response = NextResponse.redirect(clientUrl);

    response.cookies.set({
      name: "user",
      value: JSON.stringify(user),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;

  } catch (error) {
    console.error("Discord callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=CallbackFailed", settings.panelUrl)
    );
  }
}
