'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[dashboard/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          An unexpected error occurred. Please refresh, or navigate elsewhere using the sidebar.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Refresh Page
          </button>
          <Link href="/dashboard" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
