import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { getDashboardStats } from '@/lib/dashboardStats';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const stats = await getDashboardStats(ctx.organization.id);
  return NextResponse.json(stats);
}
