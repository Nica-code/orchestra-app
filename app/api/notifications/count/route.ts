import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// GET /api/notifications/count -> { unread }
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', ctx.manager.id)
    .eq('read', false);

  return NextResponse.json({ unread: count ?? 0 });
}
