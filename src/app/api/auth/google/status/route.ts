import { NextRequest, NextResponse } from "next/server";
import { unseal } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("mb_drive_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ connected: false });
    }

    const session = await unseal(sessionCookie);
    if (!session) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      user: {
        email: session.user.email,
        name: session.user.name,
        picture: session.user.picture,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
