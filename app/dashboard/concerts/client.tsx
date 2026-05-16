'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { formatFullSchedule } from '@/lib/concertDates';
import type { Concert, ConcertPosition } from '@/types';

type ConcertRow = Concert & { positions?: Pick<ConcertPosition, 'id' | 'position_name' | 'status'>[] };
type Tab = 'active' | 'upcoming' | 'past';

const POSITION_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  active: 'bg-blue-100 text-blue-700',
  filled: 'bg-green-100 text-green-700',
  exhausted: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
};

const EMPTY: Record<Tab, string> = {
  active: 'No active concerts. Create a concert and start sending.',
  upcoming: 'No upcoming concerts.',
  past: 'No past concerts yet.',
};

export function ConcertsClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('active');
  const [concerts, setConcerts] = useState<ConcertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<Tab, number>>({ active: 0, upcoming: 0, past: 0 });
  const [deleteTarget, setDeleteTarget] = useState<ConcertRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/concerts?include_positions=true&limit=100')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); return; }
        const all: ConcertRow[] = d.concerts ?? [];
        setConcerts(all);
        setCounts({
          active: all.filter((c) => c.status === 'active').length,
          upcoming: all.filter((c) => c.status === 'draft').length,
          past: all.filter((c) => c.status === 'completed' || c.status === 'cancelled').length,
        });
      })
      .catch(() => toast.error('Failed to load concerts'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = concerts.filter((c) => {
    if (tab === 'active') return c.status === 'active';
    if (tab === 'upcoming') return c.status === 'draft';
    return c.status === 'completed' || c.status === 'cancelled';
  });

  const doDelete = async (c: ConcertRow) => {
    const res = await fetch(`/api/concerts/${c.id}`, { method: 'DELETE' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error || 'Delete failed'); return; }
    toast.success('Concert deleted');
    load();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Concerts</h1>
        <Link href="/dashboard/concerts/new"><Button><Plus className="h-4 w-4" /> New Concert</Button></Link>
      </div>

      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {(['active', 'upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'
            }`}
          >
            {t}
            <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{counts[t]}</span>
          </button>
        ))}
      </div>

      {tab === 'past' && (
        <div className="mt-3">
          <Link href="/dashboard/concerts/history" className="text-sm font-medium text-indigo-600 hover:underline">
            View full concert history →
          </Link>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          {EMPTY[tab]}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{c.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">{formatFullSchedule(c.dates, c.rehearsal_dates)}</p>
                  {c.venue && (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" /> {c.venue}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/concerts/${c.id}`}><Button size="sm">Manage</Button></Link>
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/concerts/${c.id}/edit`)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {c.status === 'draft' && (
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {c.positions && c.positions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.positions.map((p) => (
                    <span key={p.id} className={`rounded-full px-2 py-0.5 text-xs ${POSITION_BADGE[p.status] ?? POSITION_BADGE.pending}`}>
                      {p.position_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget); }}
        title="Delete concert"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
