import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { getActivityDescription, ACTION_CATEGORIES } from '@/lib/activityLogger';
import type { ActivityLog } from '@/types';

export const runtime = 'nodejs';

const MAX_ROWS = 1000;

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

// GET /api/activity/export — CSV of filtered activity (max 1000 rows).
export async function GET(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const admin = createAdminClient();
  let query = admin
    .from('activity_logs')
    .select('*, managers(email)')
    .eq('organization_id', ctx.organization.id)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  const managerId = sp.get('managerId');
  const category = sp.get('actionCategory');
  const dateFrom = sp.get('dateFrom');
  const dateTo = sp.get('dateTo');
  if (managerId) query = query.eq('manager_id', managerId);
  if (category && ACTION_CATEGORIES[category]) query = query.in('action', ACTION_CATEGORIES[category]);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ['Timestamp', 'Manager', 'Action', 'Details'].map(csvCell).join(',');
  const lines = (data ?? []).map((row) => {
    const mgr = (row as { managers: { email: string } | null }).managers;
    return [
      new Date(row.created_at).toISOString(),
      mgr?.email ?? 'System',
      row.action,
      getActivityDescription(row as ActivityLog),
    ].map(csvCell).join(',');
  });
  const csv = [header, ...lines].join('\r\n');

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="firstcall-activity-${date}.csv"`,
    },
  });
}
