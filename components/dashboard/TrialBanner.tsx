'use client';

import Link from 'next/link';

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      You have <strong>{daysLeft}</strong> day{daysLeft === 1 ? '' : 's'} left in your free trial.{' '}
      <Link href="/dashboard/settings/billing" className="font-medium underline">
        Add payment method →
      </Link>
    </div>
  );
}
