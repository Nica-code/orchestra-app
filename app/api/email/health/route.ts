import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { checkEmailConnection } from '@/lib/emailHealth';

export const runtime = 'nodejs';

// GET /api/email/health — current manager's email connection status.
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const health = await checkEmailConnection(ctx.manager.id);
  return NextResponse.json(health);
}
