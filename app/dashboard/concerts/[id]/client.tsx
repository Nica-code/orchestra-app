'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { AddEditPositionModal } from '@/components/concerts/AddEditPositionModal';
import { formatFullSchedule } from '@/lib/concertDates';
import type { Concert, ConcertPosition } from '@/types';

export interface PositionSummary {
  total: number;
  sent: number;
  accepted: number;
  declined: number;
  acceptedName?: string;
}

const CONCERT_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const POSITION_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  active: 'bg-blue-100 text-blue-700',
  filled: 'bg-green-100 text-green-700',
  exhausted: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

interface Props {
  concert: Concert;
  positions: ConcertPosition[];
  summaries: Record<string, PositionSummary>;
  positionNames: string[];
}

export function ConcertDetailClient({ concert, positions, summaries, positionNames }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ConcertPosition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConcertPosition | null>(null);

  const refresh = () => router.refresh();

  const deletePosition = async (p: ConcertPosition) => {
    const res = await fetch(`/api/concerts/${concert.id}/positions/${p.id}`, { method: 'DELETE' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error || 'Delete failed'); return; }
    toast.success('Position removed');
    refresh();
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{concert.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CONCERT_BADGE[concert.status]}`}>
              {concert.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{formatFullSchedule(concert.dates, concert.rehearsal_dates)}</p>
          {concert.venue && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" /> {concert.venue}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push(`/dashboard/concerts/${concert.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit Concert
          </Button>
          <Button onClick={() => { setEditingPosition(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Position
          </Button>
        </div>
      </div>

      {/* Positions */}
      <div className="mt-6">
        {positions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
            <Users className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-2 font-medium text-slate-700">No positions added yet</p>
            <p className="mt-1 text-sm text-slate-500">Add your first position to start finding substitute musicians.</p>
            <Button className="mt-4" onClick={() => { setEditingPosition(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Position
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((p) => {
              const s = summaries[p.id] ?? { total: 0, sent: 0, accepted: 0, declined: 0 };
              const started = p.status !== 'pending';
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{p.position_name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${POSITION_BADGE[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {p.musicians_needed} musician{p.musicians_needed === 1 ? '' : 's'} needed · {s.total} on list
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingPosition(p); setModalOpen(true); }}
                        className="text-slate-500 hover:text-indigo-600" aria-label="Edit position">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {p.status === 'pending' && (
                        <button onClick={() => setDeleteTarget(p)}
                          className="text-slate-500 hover:text-red-600" aria-label="Delete position">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {started && (
                    <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {p.status === 'filled' && s.acceptedName ? (
                        <p>✓ Filled by {s.acceptedName}</p>
                      ) : p.status === 'exhausted' ? (
                        <p>⚠ All {s.total} musicians contacted — none available</p>
                      ) : (
                        <p>Contacted {s.sent} of {s.total} musicians</p>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {p.status === 'pending' && (
                      <Button size="sm" onClick={() => toast.info('The send engine arrives in Part 7.')}>
                        Start Sending
                      </Button>
                    )}
                    {started && (
                      <Link href={`/dashboard/concerts/${concert.id}/positions/${p.id}/log`}>
                        <Button size="sm" variant="secondary">View Send Log</Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddEditPositionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        concertId={concert.id}
        position={editingPosition}
        existingPositionNames={positionNames}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deletePosition(deleteTarget); }}
        title="Remove position"
        message={deleteTarget ? `Remove the "${deleteTarget.position_name}" position from this concert?` : ''}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
