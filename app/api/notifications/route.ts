import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// GET /api/notifications?page=&limit=&unread_only=
export async function GET(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)));
  const unreadOnly = sp.get('unread_only') === 'true';

  const admin = createAdminClient();
  let query = admin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('manager_id', ctx.manager.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (unreadOnly) query = query.eq('read', false);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unread } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', ctx.manager.id)
    .eq('read', false);

  return NextResponse.json({ notifications: data ?? [], total: count ?? 0, unread: unread ?? 0, page, limit });
}
