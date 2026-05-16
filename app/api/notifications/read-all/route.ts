import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// PATCH /api/notifications/read-all — mark all the manager's notifications read.
export async function PATCH() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('manager_id', ctx.manager.id)
    .eq('read', false)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
