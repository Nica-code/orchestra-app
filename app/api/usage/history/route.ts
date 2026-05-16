import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { getUsageHistory } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const history = await getUsageHistory(ctx.organization.id, 12);
  return NextResponse.json({ history });
}
