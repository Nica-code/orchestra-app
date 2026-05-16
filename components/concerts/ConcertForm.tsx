'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Concert, ConcertStatus } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Concert name is required').max(200),
  dates: z.array(z.string()).min(1, 'Add at least one performance date'),
});

const STATUS_OPTIONS: { value: ConcertStatus; label: string; desc: string }[] = [
  { value: 'draft', label: 'Draft', desc: 'Not yet sending' },
  { value: 'active', label: 'Active', desc: 'Currently sending emails' },
  { value: 'completed', label: 'Completed', desc: 'All positions filled' },
  { value: 'cancelled', label: 'Cancelled', desc: 'Concert cancelled' },
];

function DateList({ label, dates, onChange }: { label: string; dates: string[]; onChange: (d: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft) return;
    if (dates.includes(draft)) { toast.error('That date is already added'); return; }
    onChange([...dates, draft].sort());
    setDraft('');
  };
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <Button type="button" size="sm" variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {dates.map((d) => (
          <span key={d} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
            {d}
            <button type="button" onClick={() => onChange(dates.filter((x) => x !== d))} className="text-slate-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConcertForm({ concert }: { concert?: Concert }) {
  const router = useRouter();
  const isEdit = !!concert;

  const [name, setName] = useState(concert?.name ?? '');
  const [venue, setVenue] = useState(concert?.venue ?? '');
  const [notes, setNotes] = useState(concert?.notes ?? '');
  const [rehearsalDates, setRehearsalDates] = useState<string[]>(concert?.rehearsal_dates ?? []);
  const [performanceDates, setPerformanceDates] = useState<string[]>(concert?.dates ?? []);
  const [status, setStatus] = useState<ConcertStatus>(concert?.status ?? 'draft');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async (thenAddPositions: boolean) => {
    const parsed = schema.safeParse({ name, dates: performanceDates });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name,
        dates: performanceDates,
        rehearsal_dates: rehearsalDates.length ? rehearsalDates : null,
        venue: venue || null,
        notes: notes || null,
        ...(isEdit ? { status } : {}),
      };
      let concertId = concert?.id;
      if (isEdit) {
        const res = await fetch(`/api/concerts/${concertId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
      } else {
        const res = await fetch('/api/concerts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
        concertId = b.concert.id;
      }
      toast.success(isEdit ? 'Concert updated' : 'Concert created');
      router.push(thenAddPositions ? `/dashboard/concerts/${concertId}` : '/dashboard/concerts');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Concert' : 'New Concert'}</h1>

      <div className="mt-6 space-y-6">
        {/* Section 1 — basic info */}
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <Input label="Concert Name" placeholder="e.g. Masterworks 1, Holiday Pops, Chamber Concert"
            value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Input label="Venue (optional)" placeholder="e.g. Van Wezel Performing Arts Hall"
            value={venue} onChange={(e) => setVenue(e.target.value)} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes (internal only — not sent to musicians)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </section>

        {/* Section 2 — dates */}
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <DateList label="Rehearsal Dates (optional)" dates={rehearsalDates} onChange={setRehearsalDates} />
          <DateList label="Performance Dates (required)" dates={performanceDates} onChange={setPerformanceDates} />
          {errors.dates && <p className="text-xs text-red-600">{errors.dates}</p>}
        </section>

        {/* Section 3 — status (edit only) */}
        {isEdit && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="mb-2 text-sm font-medium text-slate-700">Status</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-start gap-3">
                  <input type="radio" name="status" checked={status === o.value}
                    onChange={() => setStatus(o.value)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="text-sm font-medium text-slate-800">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => save(false)} loading={saving}>Save Concert</Button>
        <Button variant="secondary" onClick={() => save(true)} loading={saving}>Save &amp; Add Positions</Button>
        <Button variant="ghost" onClick={() => router.push('/dashboard/concerts')}>Cancel</Button>
      </div>
    </div>
  );
}
