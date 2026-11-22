import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Google OAuth is not configured on the server" },
        { status: 500 }
      );
    }

    const state = crypto.randomUUID();

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file openid email profile");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(googleAuthUrl.toString());

    const isSecure =
      request.nextUrl.protocol === "https:" ||
      (request.nextUrl.hostname !== "localhost" && request.nextUrl.hostname !== "127.0.0.1");

    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
      secure: isSecure,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initiate Google OAuth", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
