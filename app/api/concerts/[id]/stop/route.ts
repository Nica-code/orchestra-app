import { NextRequest, NextResponse } from 'next/server';
import { loadOwnedConcert } from '@/lib/concertAuth';
import { logActivity } from '@/lib/activityLogger';
import { getCurrentManager } from '@/lib/auth';

// POST /api/concerts/[id]/stop — manually stop an active cascade
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error, admin, concert } = await loadOwnedConcert(params.id);
  if (error) return error;

  if (concert!.status !== 'active') {
    return NextResponse.json({ error: 'Only active cascades can be stopped' }, { status: 409 });
  }

  const admin2 = admin!;

  // 1. Cancel all active/pending positions
  await admin2
    .from('concert_positions')
    .update({ status: 'cancelled' })
    .eq('concert_id', params.id)
    .in('status', ['active', 'pending']);

  // 2. Expire any outstanding send_log tokens (so pending recipients can't respond)
  const { data: positions } = await admin2
    .from('concert_positions')
    .select('id')
    .eq('concert_id', params.id);

  const posIds = (positions ?? []).map((p) => p.id);
  if (posIds.length > 0) {
    await admin2
      .from('send_logs')
      .update({ token_expires_at: new Date().toISOString() })
      .in('concert_position_id', posIds)
      .eq('status', 'sent'); // only expire still-awaiting ones
  }

  // 3. Mark concert as cancelled
  const { data: updated } = await admin2
    .from('concerts')
    .update({ status: 'cancelled' })
    .eq('id', params.id)
    .select()
    .single();

  await logActivity({
    organizationId: ctx.organization.id,
    managerId: ctx.manager.id,
    action: 'cascade_stopped',
    entityType: 'concert',
    entityId: params.id,
    details: { concert_name: concert!.name },
  });

  return NextResponse.json({ ok: true, concert: updated });
}
