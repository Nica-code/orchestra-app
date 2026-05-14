'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import type { PlanType } from '@/types';

export function BillingActions({ isAdmin, planType, hasStripeCustomer }: {
  isAdmin: boolean;
  planType: PlanType;
  hasStripeCustomer: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Could not open portal'); return; }
      window.location.href = body.url;
    } finally {
      setBusy(false);
    }
  };

  const upgrade = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: 'pro', billing_interval: 'monthly' }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Upgrade failed'); return; }
      toast.success('Upgraded to Pro');
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-wrap gap-3">
      {planType === 'starter' && (
        <Button onClick={upgrade} loading={busy}>Upgrade to Pro</Button>
      )}
      {hasStripeCustomer && (
        <Button variant="secondary" onClick={openPortal} loading={busy}>
          Manage billing & payment method
        </Button>
      )}
    </section>
  );
}
