import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

function timeRemaining(deadlineIso: string): string {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return 'Deadline passed';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ${hours % 24} hr`;
  if (hours >= 1) return `${hours} hr`;
  return `${Math.max(1, Math.floor(ms / (1000 * 60)))} min`;
}

// GET /api/send/status/[concertPositionId]
export async function GET(_req: NextRequest, { params }: { params: { concertPositionId: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: position } = await admin
    .from('concert_positions')
    .select('*, concerts(organization_id)')
    .eq('id', params.concertPositionId)
    .maybeSingle();
  const orgId = (position as { concerts: { organization_id: string } | null } | null)?.concerts?.organization_id;
  if (!position || orgId !== ctx.organization.id) {
    return NextResponse.json({ error: 'Position not found' }, { status: 404 });
  }

  const { count: totalAvailable } = await admin
    .from('concert_position_musicians')
    .select('id', { count: 'exact', head: true })
    .eq('concert_position_id', params.concertPositionId);

  const { count: totalContacted } = await admin
    .from('concert_position_musicians')
    .select('id', { count: 'exact', head: true })
    .eq('concert_position_id', params.concertPositionId)
    .not('sent_at', 'is', null);

  // Most recent send log
  const { data: latest } = await admin
    .from('send_logs')
    .select('*, musicians(first_name, last_name, email)')
    .eq('concert_position_id', params.concertPositionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentMusician = null;
  let deadline: string | null = null;
  let remaining: string | null = null;
  if (latest && latest.status === 'sent') {
    const m = (latest as { musicians: { first_name: string; last_name: string; email: string } | null }).musicians;
    currentMusician = m ? { name: `${m.first_name} ${m.last_name}`, email: m.email, sent_at: latest.sent_at } : null;
    deadline = latest.token_expires_at;
    remaining = timeRemaining(latest.token_expires_at);
  }

  return NextResponse.json({
    position_status: position.status,
    current_musician: currentMusician,
    deadline,
    time_remaining: remaining,
    total_contacted: totalContacted ?? 0,
    total_available: totalAvailable ?? 0,
    auto_resend_enabled: position.auto_resend_enabled,
    latest_send_log: latest ?? null,
  });
}
