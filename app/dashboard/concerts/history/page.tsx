import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { HistoryClient, type HistoryRow } from './client';

export default async function ConcertHistoryPage() {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  const { data: concerts } = await admin
    .from('concerts')
    .select('id, name, dates, status, updated_at')
    .eq('organization_id', organization.id)
    .in('status', ['completed', 'cancelled'])
    .order('updated_at', { ascending: false });

  const concertIds = (concerts ?? []).map((c) => c.id);
  const byConcert = new Map<string, string[]>();
  if (concertIds.length > 0) {
    const { data: positions } = await admin
      .from('concert_positions').select('concert_id, status').in('concert_id', concertIds);
    for (const p of positions ?? []) {
      const arr = byConcert.get(p.concert_id) ?? [];
      arr.push(p.status);
      byConcert.set(p.concert_id, arr);
    }
  }

  const rows: HistoryRow[] = (concerts ?? []).map((c) => {
    const statuses = byConcert.get(c.id) ?? [];
    const total = statuses.length;
    const filled = statuses.filter((s) => s === 'filled').length;
    const exhausted = statuses.filter((s) => s === 'exhausted').length;
    return {
      id: c.id,
      name: c.name,
      dates: c.dates,
      status: c.status,
      completedAt: c.updated_at,
      totalPositions: total,
      filledPositions: filled,
      exhaustedPositions: exhausted,
      fillRate: total > 0 ? Math.round((filled / total) * 100) : 0,
    };
  });

  return <HistoryClient rows={rows} />;
}
