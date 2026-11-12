import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, requireUser } from '@/lib/api-guard';
import { listDocuments } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: every saved document across the user's cases — the evidence
// locker's file list.
export async function GET(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const documents = await listDocuments(g.user.id);
    return NextResponse.json({ documents });
  } catch {
    return dbUnavailable();
  }
}
