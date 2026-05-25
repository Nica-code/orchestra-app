'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Clock, CheckCircle2, XCircle, AlertCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Concert, ConcertPosition } from '@/types';

type ProjectRow = Concert & { positions?: Pick<ConcertPosition, 'id' | 'position_name' | 'status'>[] };

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; cls: string }> = {
  draft:     { label: 'Draft',    icon: Circle,        cls: 'text-slate-400' },
  active:    { label: 'Active',   icon: Clock,         cls: 'text-blue-500' },
  filled:    { label: 'Filled',   icon: CheckCircle2,  cls: 'text-green-500' },
  completed: { label: 'Filled',   icon: CheckCircle2,  cls: 'text-green-500' },
  cancelled: { label: 'Cancelled',icon: XCircle,       cls: 'text-red-400' },
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

export default function EmailHubPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/concerts?include_positions=true&limit=50')
      .then((r) => r.json())
      .then((d) => setProjects(d.concerts ?? []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const active   = projects.filter((p) => p.status === 'active');
  const drafts   = projects.filter((p) => p.status === 'draft');
  const closed   = projects.filter((p) => ['filled', 'completed', 'cancelled'].includes(p.status));

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email</h1>
          <p className="mt-0.5 text-sm text-slate-500">Cascade outreach sends</p>
        </div>
        <Link href="/dashboard/email/compose">
          <Button>
            <Pencil className="h-4 w-4" /> New Email
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-slate-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Pencil className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">No emails yet</p>
          <p className="mt-1 text-sm text-slate-400">Compose your first cascade email to get started.</p>
          <Link href="/dashboard/email/compose" className="mt-4 inline-block">
            <Button>New Email</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Active</h2>
              <EmailList projects={active} />
            </section>
          )}
          {drafts.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Drafts</h2>
              <EmailList projects={drafts} />
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Closed</h2>
              <EmailList projects={closed} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EmailList({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {projects.map((p) => {
        const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
        const Icon = cfg.icon;
        const positions = p.positions ?? [];
        const filled  = positions.filter((x) => x.status === 'filled').length;
        const total   = positions.length;

        return (
          <Link
            key={p.id}
            href={`/dashboard/email/compose?draft=${p.id}`}
            className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <Icon className={`h-4 w-4 shrink-0 ${cfg.cls}`} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
              {total > 0 && (
                <p className="text-xs text-slate-400">
                  {filled}/{total} position{total === 1 ? '' : 's'} filled
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className={`text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
              <p className="text-xs text-slate-400">{timeAgo(p.updated_at)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
