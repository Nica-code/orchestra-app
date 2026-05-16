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
}

export function DashboardShell({ children, organizationName, logoUrl, managerEmail, trialDaysLeft }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex flex-1 flex-col">
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
