import { NextRequest, NextResponse } from "next/server";
import { seal, SessionData } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const errorParam = searchParams.get("error");
    if (errorParam) {
      return NextResponse.json(
        { error: `Google OAuth error: ${errorParam}` },
        { status: 400 }
      );
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing required authorization code or state parameter" },
        { status: 400 }
      );
    }

    const storedState = request.cookies.get("oauth_state")?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { error: "Invalid or expired OAuth state parameter" },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured on server" },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      return NextResponse.json(
        { error: "Failed to exchange authorization code", details: errorBody },
        { status: tokenResponse.status }
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type?: string;
    };

    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: "Missing access token in token response" },
        { status: 502 }
      );
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const userError = await userResponse.text();
      return NextResponse.json(
        { error: "Failed to fetch user profile", details: userError },
        { status: userResponse.status }
      );
    }

    const userData = (await userResponse.json()) as {
      email: string;
      name?: string;
      picture?: string;
    };

    if (!userData.email) {
      return NextResponse.json(
        { error: "User email not provided by Google" },
        { status: 502 }
      );
    }

    const sessionData: SessionData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
      expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
      user: {
        email: userData.email,
        name: userData.name || userData.email,
        picture: userData.picture,
      },
    };

    const sealedSession = await seal(sessionData);

    const redirectUrl = new URL("/?sync=connected", request.url);
    const response = NextResponse.redirect(redirectUrl);

    const isSecure =
      request.nextUrl.protocol === "https:" ||
      (request.nextUrl.hostname !== "localhost" && request.nextUrl.hostname !== "127.0.0.1");

    response.cookies.set("mb_drive_session", sealedSession, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 31536000, // 1 year in seconds
    });

    response.cookies.delete("oauth_state");

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "OAuth callback failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
