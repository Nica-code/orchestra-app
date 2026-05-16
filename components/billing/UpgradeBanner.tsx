'use client';

import Link from 'next/link';
import { AlertTriangle, Info } from 'lucide-react';

type Variant = 'warning' | 'danger' | 'info';

const STYLES: Record<Variant, string> = {
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

export function UpgradeBanner({
  message, ctaText = 'Upgrade', ctaHref = '/dashboard/settings/billing', variant = 'warning',
}: {
  message: string;
  ctaText?: string;
  ctaHref?: string;
  variant?: Variant;
}) {
  const Icon = variant === 'info' ? Info : AlertTriangle;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm ${STYLES[variant]}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      <Link href={ctaHref} className="font-medium underline">{ctaText}</Link>
    </div>
  );
}
