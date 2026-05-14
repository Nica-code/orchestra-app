import { requireManager } from '@/lib/auth';
import { PLAN_CONFIG } from '@/lib/plans';

export default async function DashboardHome() {
  const { organization, plan } = await requireManager();
  const cfg = PLAN_CONFIG[plan.plan_type];
  const sendsUsed = plan.send_count;
  const pct = Math.min(100, Math.round((sendsUsed / plan.send_limit) * 100));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {organization.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Plan</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{cfg.name}</p>
          <p className="text-sm text-slate-500">{plan.status}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Sends this period</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{sendsUsed} / {plan.send_limit}</p>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Active concerts</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">0</p>
          <p className="text-sm text-slate-500">No concerts yet</p>
        </div>
      </div>
    </div>
  );
}
