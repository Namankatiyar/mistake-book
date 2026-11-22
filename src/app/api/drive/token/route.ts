import { NextRequest, NextResponse } from "next/server";
import { seal, unseal, SessionData } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("mb_drive_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await unseal(sessionCookie);
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    let accessToken = session.accessToken;
    let expiresAt = session.expiresAt;
    let updatedCookie: string | null = null;

    // Check if token expires within 5 minutes (300,000 ms)
    if (expiresAt - Date.now() < 5 * 60 * 1000) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { error: "Google OAuth credentials not configured on server" },
          { status: 500 }
        );
      }

      if (!session.refreshToken) {
        return NextResponse.json(
          { error: "No refresh token available in session" },
          { status: 401 }
        );
      }

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: session.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        return NextResponse.json(
          { error: "Failed to refresh access token", details: errorText },
          { status: 401 }
        );
      }

      const refreshData = (await refreshResponse.json()) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };

      if (!refreshData.access_token) {
        return NextResponse.json(
          { error: "Missing access token in refresh response" },
          { status: 502 }
        );
      }

      accessToken = refreshData.access_token;
      expiresAt = Date.now() + (refreshData.expires_in ?? 3600) * 1000;

      const updatedSession: SessionData = {
        ...session,
        accessToken,
        refreshToken: refreshData.refresh_token || session.refreshToken,
        expiresAt,
      };

      updatedCookie = await seal(updatedSession);
    }

    const expiresInSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const response = NextResponse.json({
      accessToken,
      expiresIn: expiresInSeconds,
    });

    if (updatedCookie) {
      const isSecure =
        request.nextUrl.protocol === "https:" ||
        (request.nextUrl.hostname !== "localhost" && request.nextUrl.hostname !== "127.0.0.1");

      response.cookies.set("mb_drive_session", updatedCookie, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 31536000,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve access token", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
