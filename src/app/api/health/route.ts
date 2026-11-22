export const dynamic = "force-dynamic";

// The app stores everything client-side in IndexedDB; the server only
// serves the shell, so health is a plain liveness check.
export async function GET() {
  return Response.json({ ok: true, storage: "indexeddb" });
}
