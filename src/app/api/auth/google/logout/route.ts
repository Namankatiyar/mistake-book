import { NextRequest, NextResponse } from "next/server";
import { unseal } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("mb_drive_session")?.value;
    if (sessionCookie) {
      const session = await unseal(sessionCookie);
      const tokenToRevoke = session?.refreshToken || session?.accessToken;
      if (tokenToRevoke) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });
        } catch {
          // Token revocation error should not prevent cookie clearing and logout completion
        }
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete("mb_drive_session");

    const isSecure =
      request.nextUrl.protocol === "https:" ||
      (request.nextUrl.hostname !== "localhost" && request.nextUrl.hostname !== "127.0.0.1");

    response.cookies.set("mb_drive_session", "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Logout failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
