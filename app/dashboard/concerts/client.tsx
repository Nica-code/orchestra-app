'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FolderOpen, Circle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { Concert, ConcertPosition } from '@/types';

type ProjectRow = Concert & { positions?: Pick<ConcertPosition, 'id' | 'position_name' | 'status'>[] };
type Tab = 'active' | 'draft' | 'closed';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',    cls: 'bg-slate-100 text-slate-500' },
  active:    { label: 'Active',   cls: 'bg-blue-100 text-blue-700' },
  filled:    { label: 'Filled',   cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Filled',   cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled',cls: 'bg-red-100 text-red-600' },
};

const POSITION_DOT: Record<string, string> = {
  pending:   'text-slate-400',
  active:    'text-blue-500',
  filled:    'text-green-500',
  exhausted: 'text-red-500',
  cancelled: 'text-slate-300',
};

const TAB_LABELS: Record<Tab, string> = {
  active: 'Active',
  draft:  'Draft',
  closed: 'Closed',
};

export function ConcertsClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('active');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<Tab, number>>({ active: 0, draft: 0, closed: 0 });
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/concerts?include_positions=true&limit=100')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        const all: ProjectRow[] = d.concerts ?? [];
        setProjects(all);
        setCounts({
          active: all.filter((p) => p.status === 'active').length,
          draft:  all.filter((p) => p.status === 'draft').length,
          closed: all.filter((p) => ['filled', 'completed', 'cancelled'].includes(p.status)).length,
        });
      })
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = projects.filter((p) => {
    if (tab === 'active') return p.status === 'active';
    if (tab === 'draft')  return p.status === 'draft';
    return ['filled', 'completed', 'cancelled'].includes(p.status);
  });

  const doDelete = async (p: ProjectRow) => {
    const res = await fetch(`/api/concerts/${p.id}`, { method: 'DELETE' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error || 'Delete failed'); return; }
    toast.success('Project deleted');
    load();
  };

  const filledCount   = (p: ProjectRow) => (p.positions ?? []).filter((x) => x.status === 'filled').length;
  const activeCount   = (p: ProjectRow) => (p.positions ?? []).filter((x) => x.status === 'active').length;
  const totalCount    = (p: ProjectRow) => (p.positions ?? []).length;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-0.5 text-sm text-slate-500">Cascade outreach workspaces</p>
        </div>
        <Link href="/dashboard/concerts/new">
          <Button><Plus className="h-4 w-4" /> New Project</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {TAB_LABELS[t]}
            <span className={`rounded-full px-1.5 text-xs ${
              tab === t ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-10 text-center text-slate-400">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">
            {tab === 'active' ? 'No active projects' : tab === 'draft' ? 'No drafts yet' : 'No closed projects'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {tab === 'draft' || tab === 'active'
              ? 'Create a project and start your cascade outreach.'
              : 'Filled and cancelled projects will appear here.'}
          </p>
          {tab !== 'closed' && (
            <Link href="/dashboard/concerts/new" className="mt-4 inline-block">
              <Button>New Project</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((p) => {
            const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.draft;
            const positions = p.positions ?? [];
            const filled = filledCount(p);
            const active = activeCount(p);
            const total = totalCount(p);

            return (
              <div
                key={p.id}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="mt-1.5 truncate text-base font-semibold text-slate-900">
                      {p.name}
                    </h3>
                    {p.notes && (
                      <p className="mt-0.5 truncate text-xs text-slate-400">{p.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => router.push(`/dashboard/concerts/${p.id}/edit`)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                      aria-label="Edit project"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {p.status === 'draft' && (
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Positions summary */}
                <div className="mt-4 flex-1">
                  {positions.length === 0 ? (
                    <p className="text-xs text-slate-400">No positions yet</p>
                  ) : (
                    <div className="space-y-1">
                      {positions.slice(0, 4).map((pos) => (
                        <div key={pos.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Circle className={`h-2 w-2 fill-current ${POSITION_DOT[pos.status] ?? POSITION_DOT.pending}`} />
                          <span className="truncate">{pos.position_name}</span>
                          <span className="ml-auto shrink-0 capitalize text-slate-400">{pos.status}</span>
                        </div>
                      ))}
                      {positions.length > 4 && (
                        <p className="text-xs text-slate-400">+{positions.length - 4} more</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats + action */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex gap-3 text-xs text-slate-500">
                    {total > 0 && (
                      <>
                        <span>{total} position{total === 1 ? '' : 's'}</span>
                        {filled > 0 && <span className="text-green-600">{filled} filled</span>}
                        {active > 0 && <span className="text-blue-600">{active} active</span>}
                      </>
                    )}
                  </div>
                  <Link href={`/dashboard/concerts/${p.id}`}>
                    <Button size="sm" variant={p.status === 'active' ? 'primary' : 'secondary'}>
                      {p.status === 'draft' ? 'Set up' : 'Manage'}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget); }}
        title="Delete project"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
