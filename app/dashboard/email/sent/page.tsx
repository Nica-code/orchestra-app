'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, Circle } from 'lucide-react';
import type { Concert, ConcertPosition } from '@/types';

type ProjectRow = Concert & { positions?: Pick<ConcertPosition, 'id' | 'position_name' | 'status'>[] };

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; cls: string }> = {
  active:    { label: 'Active',    icon: Clock,        cls: 'text-blue-500' },
  filled:    { label: 'Filled',    icon: CheckCircle2, cls: 'text-green-500' },
  completed: { label: 'Filled',    icon: CheckCircle2, cls: 'text-green-500' },
  cancelled: { label: 'Cancelled', icon: XCircle,      cls: 'text-red-400' },
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function SentPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    // Load active + filled + completed + cancelled (everything that was sent)
    Promise.all([
      fetch('/api/concerts?status=active&include_positions=true&limit=100').then((r) => r.json()),
      fetch('/api/concerts?status=filled&include_positions=true&limit=100').then((r) => r.json()),
      fetch('/api/concerts?status=completed&include_positions=true&limit=100').then((r) => r.json()),
      fetch('/api/concerts?status=cancelled&include_positions=true&limit=100').then((r) => r.json()),
    ])
      .then((results) => {
        const all = results.flatMap((d) => d.concerts ?? []) as ProjectRow[];
        all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setProjects(all);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sent</h1>
        <p className="mt-0.5 text-sm text-slate-500">All emails you&apos;ve sent</p>
      </div>

      {loading ? (
        <p className="text-center text-slate-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="font-medium text-slate-600">No sent emails yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Emails you send will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {projects.map((p) => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.active;
            const Icon = cfg.icon;
            return (
              <Link
                key={p.id}
                href={`/dashboard/email/view/${p.id}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <Icon className={`h-4 w-4 shrink-0 ${cfg.cls}`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">{timeAgo(p.updated_at)}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
