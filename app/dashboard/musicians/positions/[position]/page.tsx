import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { isCurrentlyUnavailable } from '@/lib/availability';
import { RankedList } from './ranked-list';
import type { MusicianWithStatus } from '@/types';

export default async function PositionDetailPage({ params }: { params: { position: string } }) {
  const { organization } = await requireManager();
  const position = decodeURIComponent(params.position);
  const admin = createAdminClient();

  const { data: musicians } = await admin
    .from('musicians')
    .select('*')
    .eq('organization_id', organization.id)
    .eq('position', position)
    .order('rank');

  if (!musicians || musicians.length === 0) notFound();

  const ids = musicians.map((m) => m.id);
  const { data: windows } = await admin
    .from('musician_availability')
    .select('musician_id, start_date, end_date')
    .in('musician_id', ids);
  const byMusician = new Map<string, { start_date: string; end_date: string }[]>();
  for (const w of windows ?? []) {
    const arr = byMusician.get(w.musician_id) ?? [];
    arr.push(w);
    byMusician.set(w.musician_id, arr);
  }

  const enriched: MusicianWithStatus[] = musicians.map((m) => ({
    ...m,
    currently_unavailable: isCurrentlyUnavailable(byMusician.get(m.id) ?? []),
  }));

  return <RankedList position={position} initialMusicians={enriched} />;
}
