import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { formatConcertDateShort } from '@/lib/concertDates';
import { Button } from '@/components/ui/Button';

export default async function DashboardHome() {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  // Concerts for this org
  const { data: concerts } = await admin
    .from('concerts')
    .select('id, name, dates, status, updated_at')
    .eq('organization_id', organization.id);
  const activeConcerts = (concerts ?? []).filter((c) => c.status === 'active');
  const concertIds = (concerts ?? []).map((c) => c.id);

  // Positions for those concerts
  let positionsActive = 0;
  let filledToday = 0;
  let awaitingResponse = 0;
  if (concertIds.length > 0) {
    const { data: positions } = await admin
      .from('concert_positions')
      .select('id, status, updated_at, concert_id')
      .in('concert_id', concertIds);
    positionsActive = (positions ?? []).filter((p) => p.status === 'active').length;
    const today = new Date().toISOString().slice(0, 10);
    filledToday = (positions ?? []).filter((p) => p.status === 'filled' && p.updated_at?.slice(0, 10) === today).length;

    const positionIds = (positions ?? []).map((p) => p.id);
    if (positionIds.length > 0) {
      const { count } = await admin
        .from('concert_position_musicians')
        .select('id', { count: 'exact', head: true })
        .in('concert_position_id', positionIds)
        .eq('status', 'sent');
      awaitingResponse = count ?? 0;
    }
  }

  const recentActive = [...activeConcerts]
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, 5);

  const cards = [
    { label: 'Active Concerts', value: activeConcerts.length },
    { label: 'Positions Being Filled', value: positionsActive },
    { label: 'Filled Today', value: filledToday },
    { label: 'Awaiting Response', value: awaitingResponse },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {organization.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Active Concerts</h2>
        {recentActive.length === 0 ? (
          <div className="mt-3 text-center">
            <p className="text-sm text-slate-500">No active concerts</p>
            <Link href="/dashboard/concerts/new" className="mt-3 inline-block">
              <Button>Create Concert</Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-slate-100">
              {recentActive.map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/concerts/${c.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50">
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span className="text-sm text-slate-500">{formatConcertDateShort(c.dates)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/concerts" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
              View All Concerts →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
