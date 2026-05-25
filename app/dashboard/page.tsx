import Link from 'next/link';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { getDashboardStats, getRecentActivity } from '@/lib/dashboardStats';
import { getCurrentUsage } from '@/lib/usage';
import { Button } from '@/components/ui/Button';

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

  const { data: activeEmails } = await admin
    .from('concerts')
    .select('id, name, status, updated_at')
    .eq('organization_id', organization.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(5);

  const cards = [
    { label: 'Active Emails', value: stats.activeConcerts, sub: 'In progress', href: '/dashboard/email/sent' },
    { label: 'Awaiting Response', value: stats.pendingResponses, sub: 'Sent, waiting for reply', href: '/dashboard/email/sent' },
    { label: 'Filled Today', value: stats.filledToday, sub: 'Contacts confirmed', href: '/dashboard/email/sent' },
    { label: 'Positions Being Filled', value: stats.positionsBeingFilled, sub: 'Cascade in progress', href: '/dashboard/email/sent' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {organization.name}</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-indigo-300 transition-colors">
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* Usage */}
      <Link href="/dashboard/settings/billing"
        className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-indigo-300 transition-colors">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">Monthly Sends</p>
          <span className="text-xs text-slate-400">Resets in {usage.daysRemainingInPeriod} days</span>
        </div>
        <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100">
          <div className={`h-2.5 rounded-full ${usageColor}`} style={{ width: `${Math.min(100, usage.percentageUsed)}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-700">{usage.sendCount} / {usage.sendLimit} sends used</p>
        {usage.isOverLimit ? (
          <p className="mt-1 text-sm text-red-600">Over limit — overage charges apply. Upgrade →</p>
        ) : usage.percentageUsed >= 80 ? (
          <p className="mt-1 text-sm text-yellow-700">Close to limit. Upgrade to Pro →</p>
        ) : null}
      </Link>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/email/compose"><Button>Compose New Message</Button></Link>
        <Link href="/dashboard/musicians/import"><Button variant="secondary">Import Contacts</Button></Link>
        <Link href="/dashboard/templates"><Button variant="secondary">View Templates</Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active emails */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Active Emails</h2>
            <Link href="/dashboard/email/sent" className="text-sm font-medium text-indigo-600 hover:underline">View All</Link>
          </div>
          {(activeEmails ?? []).length === 0 ? (
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">No active emails</p>
              <Link href="/dashboard/email/compose" className="mt-3 inline-block">
                <Button size="sm">Compose</Button>
              </Link>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {(activeEmails ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <Link href={`/dashboard/email/view/${c.id}`} className="text-xs text-slate-400 hover:text-slate-700">View</Link>
                    <Link href={`/dashboard/email/compose?draft=${c.id}`}>
                      <Button size="sm" variant="secondary">Edit</Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
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
