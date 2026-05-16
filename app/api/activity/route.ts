import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { getActivityDescription, ACTION_CATEGORIES } from '@/lib/activityLogger';
import type { ActivityLog } from '@/types';

export const runtime = 'nodejs';

// GET /api/activity?managerId=&actionCategory=&dateFrom=&dateTo=&page=&limit=
export async function GET(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const managerId = sp.get('managerId');
  const category = sp.get('actionCategory');
  const dateFrom = sp.get('dateFrom');
  const dateTo = sp.get('dateTo');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '25', 10)));

  const admin = createAdminClient();
  let query = admin
    .from('activity_logs')
    .select('*, managers(email)', { count: 'exact' })
    .eq('organization_id', ctx.organization.id)
    .order('created_at', { ascending: false });

  if (managerId) query = query.eq('manager_id', managerId);
  if (category && ACTION_CATEGORIES[category]) query = query.in('action', ACTION_CATEGORIES[category]);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((row) => {
    const mgr = (row as { managers: { email: string } | null }).managers;
    return {
      id: row.id,
      action: row.action,
      description: getActivityDescription(row as ActivityLog),
      managerName: mgr?.email ?? 'System',
      details: row.details,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ items, total: count ?? 0, page, limit });
}
