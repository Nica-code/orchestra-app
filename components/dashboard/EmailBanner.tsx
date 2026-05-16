'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

// Polls the email health endpoint on mount; shows a banner if no email is connected.
export function EmailBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/email/health')
      .then((r) => r.json())
      .then((h) => { if (active && h && h.connected === false) setShow(true); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!show) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>No email connected. Connect your email to start sending.</span>
      <Link href="/dashboard/settings/email" className="font-medium underline">Settings</Link>
    </div>
  );
}
