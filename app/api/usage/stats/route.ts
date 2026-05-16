import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { getCurrentUsage } from '@/lib/usage';

export const runtime = 'nodejs';

// GET /api/usage/stats — current-period summary + send breakdown.
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = await getCurrentUsage(ctx.organization.id);
  const admin = createAdminClient();

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now.getTime() - 7 * 86400000);

  // send_logs with a real send (sent_at not null) for this org
  const { data: logs } = await admin
    .from('send_logs')
    .select('sent_at, concert_position_id')
    .eq('organization_id', ctx.organization.id)
    .not('sent_at', 'is', null);

  const sends = logs ?? [];
  const sendsToday = sends.filter((s) => s.sent_at && s.sent_at >= startOfDay.toISOString()).length;
  const sendsThisWeek = sends.filter((s) => s.sent_at && s.sent_at >= startOfWeek.toISOString()).length;
  const sendsThisMonth = summary.sendCount;

  // top positions by send volume
  const positionIds = Array.from(new Set(sends.map((s) => s.concert_position_id).filter(Boolean))) as string[];
  const counts: Record<string, number> = {};
  for (const s of sends) if (s.concert_position_id) counts[s.concert_position_id] = (counts[s.concert_position_id] ?? 0) + 1;
  let topPositions: { position: string; count: number }[] = [];
  if (positionIds.length > 0) {
    const { data: positions } = await admin
      .from('concert_positions').select('id, position_name').in('id', positionIds);
    const nameById = new Map((positions ?? []).map((p) => [p.id, p.position_name]));
    topPositions = Object.entries(counts)
      .map(([id, count]) => ({ position: nameById.get(id) ?? 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  const { count: concertCount } = await admin
    .from('concerts').select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.organization.id);
  const averagePerConcert = concertCount && concertCount > 0
    ? Math.round((sendsThisMonth / concertCount) * 10) / 10 : 0;

  return NextResponse.json({
    summary,
    breakdown: { sendsToday, sendsThisWeek, sendsThisMonth, averagePerConcert, topPositions },
  });
}
