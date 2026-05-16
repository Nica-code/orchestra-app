import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { getDashboardStats, getRecentActivity } from '@/lib/dashboardStats';
import { getCurrentUsage } from '@/lib/usage';
import { formatConcertDateShort } from '@/lib/concertDates';
import { Button } from '@/components/ui/Button';

const POSITION_CHIP: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  active: 'bg-blue-100 text-blue-700',
  filled: 'bg-green-100 text-green-700',
  exhausted: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

export default async function DashboardHome() {
  const { organization } = await requireManager();
  const admin = createAdminClient();

  const [stats, activity, usage] = await Promise.all([
    getDashboardStats(organization.id),
    getRecentActivity(organization.id, 10),
    getCurrentUsage(organization.id),
  ]);
  const usageColor = usage.percentageUsed >= 100 ? 'bg-red-500'
    : usage.percentageUsed >= 80 ? 'bg-yellow-500' : 'bg-green-500';

  const { data: concerts } = await admin
    .from('concerts')
    .select('id, name, dates, status, updated_at')
    .eq('organization_id', organization.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(5);
  const concertIds = (concerts ?? []).map((c) => c.id);
  const byConcert = new Map<string, { position_name: string; status: string }[]>();
  if (concertIds.length > 0) {
    const { data: positions } = await admin
      .from('concert_positions').select('concert_id, position_name, status').in('concert_id', concertIds);
    for (const p of positions ?? []) {
      const arr = byConcert.get(p.concert_id) ?? [];
      arr.push({ position_name: p.position_name, status: p.status });
      byConcert.set(p.concert_id, arr);
    }
  }

  const cards = [
    { label: 'Active Concerts', value: stats.activeConcerts, sub: 'In progress', accent: 'text-slate-900' },
    { label: 'Positions Being Filled', value: stats.positionsBeingFilled, sub: 'Awaiting responses', accent: 'text-slate-900' },
    { label: 'Filled Today', value: stats.filledToday, sub: 'Musicians confirmed', accent: 'text-green-600' },
    { label: 'Pending Responses', value: stats.pendingResponses, sub: 'Awaiting reply', accent: 'text-amber-600' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {organization.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href="/dashboard/concerts" className="rounded-lg border border-slate-200 bg-white p-5 hover:border-indigo-300">
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.accent}`}>{c.value}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* Usage widget */}
      <Link href="/dashboard/settings/billing"
        className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-indigo-300">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">Monthly Sends</p>
          <span className="text-xs text-slate-400">Resets in {usage.daysRemainingInPeriod} days</span>
        </div>
        <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100">
          <div className={`h-2.5 rounded-full ${usageColor}`} style={{ width: `${Math.min(100, usage.percentageUsed)}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-700">{usage.sendCount} / {usage.sendLimit} sends used</p>
        {usage.isOverLimit ? (
          <p className="mt-1 text-sm text-red-600">
            Over limit by {usage.overageCount} — overage charges apply. Upgrade for more →
          </p>
        ) : usage.percentageUsed >= 80 ? (
          <p className="mt-1 text-sm text-yellow-700">You&apos;re close to your limit. Upgrade to Pro →</p>
        ) : null}
      </Link>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/concerts/new"><Button>New Concert</Button></Link>
        <Link href="/dashboard/musicians/import"><Button variant="secondary">Import Musicians</Button></Link>
        <Link href="/dashboard/templates"><Button variant="secondary">View Templates</Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Active Concerts</h2>
            <Link href="/dashboard/concerts" className="text-sm font-medium text-indigo-600 hover:underline">View All</Link>
          </div>
          {(concerts ?? []).length === 0 ? (
            <div className="mt-3 text-center">
              <p className="text-sm text-slate-500">No active concerts</p>
              <Link href="/dashboard/concerts/new" className="mt-3 inline-block"><Button>Create Concert</Button></Link>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {(concerts ?? []).map((c) => (
                <li key={c.id} className="rounded-md border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500">{formatConcertDateShort(c.dates)}</p>
                    </div>
                    <Link href={`/dashboard/concerts/${c.id}`}>
                      <Button size="sm" variant="secondary">Manage</Button>
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(byConcert.get(c.id) ?? []).map((p, i) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${POSITION_CHIP[p.status] ?? POSITION_CHIP.pending}`}>
                        {p.position_name}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No activity yet</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {activity.map((a) => (
                <li key={a.id} className="py-2">
                  <p className="text-sm text-slate-800">{a.description}</p>
                  <p className="text-xs text-slate-400">{a.timeAgo} · via {a.managerName}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
