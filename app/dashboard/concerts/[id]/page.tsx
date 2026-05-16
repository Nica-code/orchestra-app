import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { ConcertDetailClient, type PositionSummary } from './client';

export default async function ConcertDetailPage({ params }: { params: { id: string } }) {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  const { data: concert } = await admin.from('concerts').select('*').eq('id', params.id).maybeSingle();
  if (!concert || concert.organization_id !== organization.id) notFound();

  const { data: positions } = await admin
    .from('concert_positions')
    .select('*')
    .eq('concert_id', params.id)
    .order('created_at');

  // musician status counts per position
  const positionIds = (positions ?? []).map((p) => p.id);
  const summaries: Record<string, PositionSummary> = {};
  if (positionIds.length > 0) {
    const { data: cpm } = await admin
      .from('concert_position_musicians')
      .select('concert_position_id, status, sent_at, musician_id, musicians(first_name, last_name)')
      .in('concert_position_id', positionIds);
    for (const id of positionIds) summaries[id] = { total: 0, sent: 0, accepted: 0, declined: 0 };
    for (const row of cpm ?? []) {
      const s = summaries[row.concert_position_id];
      if (!s) continue;
      s.total += 1;
      if (row.sent_at) s.sent += 1;
      if (row.status === 'accepted') {
        s.accepted += 1;
        const m = (row as unknown as { musicians: { first_name: string; last_name: string } | null }).musicians;
        if (m) s.acceptedName = `${m.first_name} ${m.last_name}`;
      }
      if (row.status === 'declined') s.declined += 1;
    }
  }

  // existing position names across the org (for the modal datalist)
  const { data: orgMusicians } = await admin
    .from('musicians')
    .select('position')
    .eq('organization_id', organization.id);
  const positionNames = Array.from(new Set((orgMusicians ?? []).map((m) => m.position))).sort();

  return (
    <ConcertDetailClient
      concert={concert}
      positions={positions ?? []}
      summaries={summaries}
      positionNames={positionNames}
    />
  );
}
