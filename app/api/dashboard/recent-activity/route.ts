import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { getRecentActivity } from '@/lib/dashboardStats';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10)));
  const activity = await getRecentActivity(ctx.organization.id, limit);
  return NextResponse.json({ activity });
}
