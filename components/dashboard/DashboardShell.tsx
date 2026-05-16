'use client';

import { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TrialBanner } from './TrialBanner';
import { EmailBanner } from './EmailBanner';

interface Props {
  children: ReactNode;
  organizationName: string;
  logoUrl: string | null;
  managerEmail: string;
  trialDaysLeft: number | null;
  paymentFailed?: boolean;
  sendLimitReached?: boolean;
}

export function DashboardShell({
  children, organizationName, logoUrl, managerEmail, trialDaysLeft, paymentFailed, sendLimitReached,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex flex-1 flex-col">
        {paymentFailed && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800">
            ⚠ Payment failed. Update your payment method to avoid losing access.{' '}
            <a href="/dashboard/settings/billing" className="font-medium underline">Update now</a>
          </div>
        )}
        {sendLimitReached && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
            ⚠ Monthly send limit reached. Additional sends will incur overage charges.{' '}
            <a href="/dashboard/settings/billing" className="font-medium underline">View Billing</a>
          </div>
        )}
        {trialDaysLeft !== null && trialDaysLeft > 0 && <TrialBanner daysLeft={trialDaysLeft} />}
        <EmailBanner />
        <Header
          organizationName={organizationName}
          logoUrl={logoUrl}
          managerEmail={managerEmail}
          onMenu={() => setOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
