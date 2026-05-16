'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PLAN_CONFIG } from '@/lib/plans';
import type { UsageSummary, UsageHistory, PlanType } from '@/types';

interface Invoice {
  id: string; date: string | null; description: string;
  amount: number; status: string | null; pdf: string | null;
}

interface Props {
  isAdmin: boolean;
  planType: PlanType;
  status: string;
  trialDaysLeft: number | null;
  cancelsAt: string | null;
  hasStripeCustomer: boolean;
  usage: UsageSummary;
  history: UsageHistory[];
}

function usageColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function BillingClient(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const cfg = PLAN_CONFIG[props.planType];
  const overageBlocks = Math.ceil(props.usage.overageCount / 1000);

  useEffect(() => {
    if (props.hasStripeCustomer) {
      fetch('/api/billing/invoices').then((r) => r.json()).then((d) => setInvoices(d.invoices ?? [])).catch(() => {});
    }
  }, [props.hasStripeCustomer]);

  const post = async (url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  };

  const changePlan = async (newPlanType: PlanType) => {
    setBusy(true);
    try {
      const { ok, data } = await post('/api/subscriptions/update', { newPlanType, billingInterval: 'monthly' });
      if (!ok) { toast.error(String(data.error ?? 'Failed')); return; }
      if (data.applied === 'scheduled') toast.success(`Plan change scheduled for ${data.effectiveDate ?? 'next billing date'}.`);
      else toast.success(`Switched to ${PLAN_CONFIG[newPlanType].name}.`);
      router.refresh();
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const { ok, data } = await post('/api/subscriptions/cancel');
      if (!ok) { toast.error(String(data.error ?? 'Failed')); return; }
      toast.success('Subscription cancelled. You keep access until the period ends.');
      router.refresh();
    } finally { setBusy(false); }
  };

  const reactivate = async () => {
    setBusy(true);
    try {
      const { ok, data } = await post('/api/subscriptions/reactivate');
      if (!ok) { toast.error(String(data.error ?? 'Failed')); return; }
      toast.success('Subscription reactivated.');
      router.refresh();
    } finally { setBusy(false); }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const { ok, data } = await post('/api/billing/portal');
      if (!ok) { toast.error(String(data.error ?? 'Could not open portal')); return; }
      window.location.href = String(data.url);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>

      {/* Section 1 — Current plan */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700">{cfg.name}</span>
            <p className="mt-2 text-lg font-semibold">${cfg.priceMonthly}/month</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            props.status === 'active' ? 'bg-green-100 text-green-800' :
            props.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
            props.status === 'past_due' ? 'bg-red-100 text-red-800' :
            props.status === 'cancelling' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
          }`}>{props.status}</span>
        </div>

        {props.status === 'trialing' && props.trialDaysLeft !== null && (
          <p className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
            Free trial — {props.trialDaysLeft} day{props.trialDaysLeft === 1 ? '' : 's'} remaining. No charge until the trial ends.
          </p>
        )}
        {props.status === 'cancelling' && props.cancelsAt && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Cancelled — access until {new Date(props.cancelsAt).toLocaleDateString()}.{' '}
            {props.isAdmin && (
              <button onClick={reactivate} className="font-medium underline" disabled={busy}>Reactivate</button>
            )}
          </div>
        )}

        {props.isAdmin && props.status !== 'cancelling' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {props.planType === 'starter' && (
              <Button onClick={() => changePlan('pro')} loading={busy}>Upgrade to Pro</Button>
            )}
            {props.planType === 'pro' && (
              <Button variant="secondary" onClick={() => changePlan('starter')} loading={busy}>
                Downgrade to Starter
              </Button>
            )}
            {props.hasStripeCustomer && (
              <Button variant="secondary" onClick={openPortal} loading={busy}>Manage payment method</Button>
            )}
          </div>
        )}
        {props.isAdmin && props.status !== 'cancelling' && props.status !== 'cancelled' && (
          <button onClick={() => setConfirmCancel(true)} className="mt-3 text-xs text-red-600 hover:underline">
            Cancel subscription
          </button>
        )}
      </section>

      {/* Section 2 — Usage this period */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Sends this billing period</h2>
        <p className="text-xs text-slate-500">
          {new Date(props.usage.currentPeriodStart).toLocaleDateString()} — {new Date(props.usage.currentPeriodEnd).toLocaleDateString()}
        </p>
        <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100">
          <div className={`h-2.5 rounded-full ${usageColor(props.usage.percentageUsed)}`}
            style={{ width: `${Math.min(100, props.usage.percentageUsed)}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-700">{props.usage.sendCount} of {props.usage.sendLimit} sends used</p>
        <p className="text-sm text-slate-500">
          {props.usage.isOverLimit
            ? `Over limit by ${props.usage.overageCount} sends`
            : `${props.usage.remainingSends} sends remaining`}
        </p>
        {props.usage.isOverLimit && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
            Overage sends: {props.usage.overageCount} · Estimated charge: ${overageBlocks * 10}.00
            <span className="block text-xs">(Charged at the end of the billing period)</span>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">Resets in {props.usage.daysRemainingInPeriod} days</p>
        {props.planType === 'starter' && props.usage.percentageUsed >= 80 && (
          <p className="mt-2 text-sm">
            <button onClick={() => changePlan('pro')} className="font-medium text-indigo-600 hover:underline">
              Upgrade to Pro for 3,000 sends/month →
            </button>
          </p>
        )}
      </section>

      {/* Section 3 — Usage history */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Usage history</h2>
        {props.history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No past billing periods yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2">Period</th><th>Plan</th><th>Sends</th><th>Overage</th><th>Charge</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {props.history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2">{new Date(h.billing_period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                    <td className="capitalize">{h.plan_type}</td>
                    <td>{h.send_count} / {h.send_limit}</td>
                    <td>{h.overage_count > 0 ? `${h.overage_count} sends` : '—'}</td>
                    <td>{h.overage_amount_cents > 0 ? `$${(h.overage_amount_cents / 100).toFixed(2)}` : 'Included'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 5 — Invoices */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2">Date</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2">{inv.date ? new Date(inv.date).toLocaleDateString() : '—'}</td>
                    <td>{inv.description}</td>
                    <td>${inv.amount.toFixed(2)}</td>
                    <td className="capitalize">{inv.status}</td>
                    <td>{inv.pdf && <a href={inv.pdf} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">PDF</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        title="Cancel subscription?"
        message="You will retain access until the end of your current billing period. Your data is preserved for 30 days after cancellation."
        confirmLabel="Cancel Subscription"
        danger
      />
    </div>
  );
}
