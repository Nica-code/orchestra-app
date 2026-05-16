import { NextRequest, NextResponse } from 'next/server';
import { loadOwnedPosition } from '@/lib/concertAuth';

export const runtime = 'nodejs';

// GET — full send log for a position.
export async function GET(_req: NextRequest, { params }: { params: { id: string; positionId: string } }) {
  const { error, admin, concert, position } = await loadOwnedPosition(params.id, params.positionId);
  if (error) return error;

  const { data: rows } = await admin!
    .from('concert_position_musicians')
    .select('*, musicians(first_name, last_name, email)')
    .eq('concert_position_id', params.positionId)
    .order('rank');

  // Latest send_log per concert_position_musician
  const { data: logs } = await admin!
    .from('send_logs')
    .select('*')
    .eq('concert_position_id', params.positionId)
    .order('created_at', { ascending: false });
  type LogRow = NonNullable<typeof logs>[number];
  const logByCpm = new Map<string, LogRow>();
  for (const l of logs ?? []) {
    if (l.concert_position_musician_id && !logByCpm.has(l.concert_position_musician_id)) {
      logByCpm.set(l.concert_position_musician_id, l);
    }
  }

  const summary = { totalContacted: 0, accepted: 0, declined: 0, noResponse: 0, skipped: 0, pending: 0 };
  const musicians = (rows ?? []).map((r) => {
    const m = (r as { musicians: { first_name: string; last_name: string; email: string } | null }).musicians;
    const sendLog = logByCpm.get(r.id) ?? null;
    if (r.status === 'sent') { summary.totalContacted++; summary.pending++; }
    else if (r.status === 'accepted') { summary.totalContacted++; summary.accepted++; }
    else if (r.status === 'declined') { summary.totalContacted++; summary.declined++; }
    else if (r.status === 'no_response') { summary.totalContacted++; summary.noResponse++; }
    else if (r.status === 'skipped') { summary.skipped++; }
    return {
      rank: r.rank,
      status: r.status,
      musician: { first_name: m?.first_name ?? '', last_name: m?.last_name ?? '', email: m?.email ?? '' },
      sendLog,
      skipReason: r.skip_reason ?? null,
    };
  });

  return NextResponse.json({ concert, position, musicians, summary });
}
