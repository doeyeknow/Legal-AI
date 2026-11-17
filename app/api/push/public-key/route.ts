// GET /api/push/public-key — the public VAPID key browsers need
// to create a push subscription. Only the public key is ever
// exposed; the private key stays in the server-only
// VAPID_PRIVATE_KEY env var. No sign-in needed: the key is public
// by design, and the subscribe endpoint is what requires a user.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json({ publicKey, configured: Boolean(publicKey) });
}
