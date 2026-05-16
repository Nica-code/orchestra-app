'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Musician, MusicianAvailability } from '@/types';

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  position: z.string().min(1, 'Required'),
  rank: z.number().int().min(1, 'Must be 1 or higher'),
  phone: z.string().optional(),
  notes: z.string().max(500, 'Max 500 characters').optional(),
});
type FormData = z.infer<typeof schema>;

interface DraftWindow { id?: string; start_date: string; end_date: string; reason: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  musician?: Musician | null;          // null/undefined = add mode
  positions: string[];                 // existing positions for datalist
  suggestNextRank?: (position: string) => number;
}

export function AddEditMusician({ open, onClose, onSaved, musician, positions, suggestNextRank }: Props) {
  const isEdit = !!musician;
  const [blacklisted, setBlacklisted] = useState(false);
  const [confirmBlacklist, setConfirmBlacklist] = useState(false);
  const [windows, setWindows] = useState<DraftWindow[]>([]);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const notesValue = watch('notes') ?? '';
  const positionValue = watch('position') ?? '';

  useEffect(() => {
    if (!open) return;
    if (musician) {
      reset({
        first_name: musician.first_name,
        last_name: musician.last_name,
        email: musician.email,
        position: musician.position,
        rank: musician.rank,
        phone: musician.phone ?? '',
        notes: musician.notes ?? '',
      });
      setBlacklisted(musician.is_blacklisted);
      fetch(`/api/musicians/${musician.id}/availability`)
        .then((r) => r.json())
        .then((d) => setWindows((d.availability ?? []).map((w: MusicianAvailability) => ({
          id: w.id, start_date: w.start_date, end_date: w.end_date, reason: w.reason ?? '',
        }))))
        .catch(() => {});
    } else {
      reset({ first_name: '', last_name: '', email: '', position: '', rank: 1, phone: '', notes: '' });
      setBlacklisted(false);
      setWindows([]);
    }
  }, [open, musician, reset]);

  // Auto-suggest next rank when position changes in add mode
  useEffect(() => {
    if (!isEdit && positionValue && suggestNextRank) {
      setValue('rank', suggestNextRank(positionValue));
    }
  }, [positionValue, isEdit, suggestNextRank, setValue]);

  const toggleBlacklist = () => {
    if (!blacklisted) setConfirmBlacklist(true);
    else setBlacklisted(false);
  };

  const addWindow = () => setWindows((w) => [...w, { start_date: '', end_date: '', reason: '' }]);
  const removeWindow = (idx: number) => setWindows((w) => w.filter((_, i) => i !== idx));
  const updateWindow = (idx: number, patch: Partial<DraftWindow>) =>
    setWindows((w) => w.map((win, i) => (i === idx ? { ...win, ...patch } : win)));

  const syncAvailability = async (musicianId: string, existing: DraftWindow[]) => {
    // delete removed (edit mode only): server is source of truth via ids
    if (isEdit) {
      const current = await fetch(`/api/musicians/${musicianId}/availability`).then((r) => r.json());
      const keepIds = new Set(existing.filter((w) => w.id).map((w) => w.id));
      for (const w of (current.availability ?? []) as MusicianAvailability[]) {
        if (!keepIds.has(w.id)) {
          await fetch(`/api/musicians/${musicianId}/availability?entry=${w.id}`, { method: 'DELETE' });
        }
      }
    }
    // add new windows (those without an id)
    for (const w of existing) {
      if (w.id) continue;
      if (!w.start_date || !w.end_date) continue;
      await fetch(`/api/musicians/${musicianId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: w.start_date, end_date: w.end_date, reason: w.reason || null }),
      });
    }
  };

  const onSubmit = async (values: FormData) => {
    for (const w of windows) {
      if ((w.start_date && !w.end_date) || (!w.start_date && w.end_date)) {
        toast.error('Each unavailability period needs both a start and end date'); return;
      }
      if (w.start_date && w.end_date && w.start_date > w.end_date) {
        toast.error('Unavailability start date must be on or before end date'); return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        position: values.position,
        rank: values.rank,
        phone: values.phone || null,
        notes: values.notes || null,
        is_blacklisted: blacklisted,
      };
      let musicianId = musician?.id;
      if (isEdit) {
        const res = await fetch(`/api/musicians/${musicianId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) { toast.error(body.error || 'Save failed'); return; }
      } else {
        const res = await fetch('/api/musicians', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) { toast.error(body.error || 'Save failed'); return; }
        musicianId = body.musician.id;
      }
      if (musicianId) await syncAvailability(musicianId, windows);
      toast.success(isEdit ? 'Musician updated' : 'Musician added');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit musician' : 'Add musician'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" {...register('first_name')} error={errors.first_name?.message} />
          <Input label="Last name" {...register('last_name')} error={errors.last_name?.message} />
        </div>
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input label="Position" list="position-options" {...register('position')} error={errors.position?.message} />
            <datalist id="position-options">
              {positions.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <Input label="Rank" type="number" min={1} {...register('rank', { valueAsNumber: true })} error={errors.rank?.message} />
        </div>
        <Input label="Phone (optional)" {...register('phone')} error={errors.phone?.message} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
          <textarea
            {...register('notes')}
            maxLength={500}
            rows={3}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-red-600">{errors.notes?.message}</span>
            <span className="text-slate-400">{notesValue.length}/500</span>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
          <input type="checkbox" checked={blacklisted} onChange={toggleBlacklist} className="h-4 w-4" />
          <span className="text-sm font-medium text-slate-700">Do not contact</span>
          {blacklisted && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Blacklisted</span>}
        </label>

        {/* Unavailability */}
        <div className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Mark as Unavailable</p>
            <Button type="button" size="sm" variant="secondary" onClick={addWindow}>
              <Plus className="h-4 w-4" /> Add Date Range
            </Button>
          </div>
          {windows.length === 0 && <p className="mt-2 text-xs text-slate-400">No unavailability periods.</p>}
          <div className="mt-3 space-y-2">
            {windows.map((w, i) => (
              <div key={w.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2 rounded border border-slate-100 bg-slate-50 p-2">
                <div>
                  <label className="block text-xs text-slate-500">Start</label>
                  <input type="date" value={w.start_date} onChange={(e) => updateWindow(i, { start_date: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">End</label>
                  <input type="date" value={w.end_date} onChange={(e) => updateWindow(i, { end_date: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500">Reason (optional)</label>
                  <input type="text" value={w.reason} placeholder="Vacation"
                    onChange={(e) => updateWindow(i, { reason: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
                <button type="button" onClick={() => removeWindow(i)} className="p-1 text-slate-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Add musician'}</Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmBlacklist}
        onClose={() => setConfirmBlacklist(false)}
        onConfirm={() => setBlacklisted(true)}
        title="Do not contact"
        message="Mark this musician as do not contact? They will be skipped automatically when sending."
        confirmLabel="Yes, blacklist"
        danger
      />
    </Modal>
  );
}
