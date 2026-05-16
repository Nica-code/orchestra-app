import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// PATCH /api/notifications/[id]/read — mark one notification read.
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: notification } = await admin
    .from('notifications').select('manager_id').eq('id', params.id).maybeSingle();
  if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (notification.manager_id !== ctx.manager.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await admin
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
