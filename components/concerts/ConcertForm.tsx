'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Concert, EmailTemplate, ProjectStatus } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
});

const STATUS_OPTIONS: { value: ProjectStatus; label: string; desc: string }[] = [
  { value: 'draft',     label: 'Draft',    desc: 'Not yet sending' },
  { value: 'active',   label: 'Active',   desc: 'Cascade is running' },
  { value: 'filled',   label: 'Filled',   desc: 'Someone accepted' },
  { value: 'cancelled',label: 'Cancelled',desc: 'Project cancelled' },
];

const DEADLINE_PRESETS = [
  { hours: 24,  label: '24 hours' },
  { hours: 48,  label: '48 hours' },
  { hours: 72,  label: '72 hours' },
  { hours: 168, label: '1 week' },
];

function VariableEditor({
  variables,
  onChange,
}: {
  variables: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const add = () => {
    const key = newKey.trim().replace(/\s+/g, '_').toLowerCase();
    if (!key || !newVal.trim()) return;
    onChange({ ...variables, [key]: newVal.trim() });
    setNewKey('');
    setNewVal('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        Custom Variables
        <span className="ml-1 text-xs font-normal text-slate-400">
          Use as {'{{key}}'} in your template
        </span>
      </label>
      {Object.entries(variables).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <span className="rounded bg-indigo-50 px-2 py-1 font-mono text-indigo-700">{`{{${k}}}`}</span>
          <span className="flex-1 text-slate-600">{v}</span>
          <button
            type="button"
            onClick={() => {
              const next = { ...variables };
              delete next[k];
              onChange(next);
            }}
            className="text-slate-400 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          placeholder="variable_name"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="w-36 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm"
        />
        <input
          placeholder="value"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ConcertForm({ concert }: { concert?: Concert }) {
  const router = useRouter();
  const isEdit = !!concert;

  const [name, setName] = useState(concert?.name ?? '');
  const [notes, setNotes] = useState(concert?.notes ?? '');
  const [templateId, setTemplateId] = useState<string>(concert?.template_id ?? '');
  const [deadlineHours, setDeadlineHours] = useState(concert?.accept_deadline_hours ?? 48);
  const [deadlineText, setDeadlineText] = useState(concert?.accept_deadline_text ?? '');
  const [customVariables, setCustomVariables] = useState<Record<string, string>>(
    concert?.custom_variables ?? {}
  );
  const [status, setStatus] = useState<ProjectStatus>(concert?.status ?? 'draft');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  const save = async (thenAddPositions: boolean) => {
    const parsed = schema.safeParse({ name });
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
        notes: notes || null,
        template_id: templateId || null,
        accept_deadline_hours: deadlineHours,
        accept_deadline_text: deadlineText || null,
        custom_variables: customVariables,
        ...(isEdit ? { status } : {}),
      };
      let projectId = concert?.id;
      if (isEdit) {
        const res = await fetch(`/api/concerts/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
      } else {
        const res = await fetch('/api/concerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const b = await res.json();
        if (!res.ok) { toast.error(b.error || 'Save failed'); return; }
        projectId = b.concert.id;
      }
      toast.success(isEdit ? 'Project updated' : 'Project created');
      router.push(thenAddPositions ? `/dashboard/concerts/${projectId}` : '/dashboard/concerts');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">
        {isEdit ? 'Edit Project' : 'New Project'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Projects are cascade outreach workspaces. Add positions and a recipient sequence to start sending.
      </p>

      <div className="mt-6 space-y-4">

        {/* Name */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Project</h2>
          <Input
            label="Project Name"
            placeholder="e.g. Spring Pops Violin Sub, Last-Minute Viola Coverage"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Internal Notes
              <span className="ml-1 text-xs font-normal text-slate-400">(not sent to recipients)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Context for your team — budget, priority, special notes…"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </section>

        {/* Template */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Default Template</h2>
          <p className="mb-2 text-xs text-slate-500">
            Sets the default for all positions in this project. Each position can override it.
          </p>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">No default — pick per position</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </section>

        {/* Deadline */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Accept Deadline
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            How long to wait for a response before automatically moving to the next person.
          </p>
          <div className="flex flex-wrap gap-2">
            {DEADLINE_PRESETS.map((p) => (
              <button
                key={p.hours}
                type="button"
                onClick={() => setDeadlineHours(p.hours)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  deadlineHours === p.hours
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:border-indigo-300'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={8760}
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(Number(e.target.value))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-slate-500">hours custom</span>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Deadline sentence for emails
              <span className="ml-1 text-xs font-normal text-slate-400">optional — use {'{{accept_deadline}}'} in template</span>
            </label>
            <input
              type="text"
              value={deadlineText}
              onChange={(e) => setDeadlineText(e.target.value)}
              placeholder={`e.g. Please respond by ${new Date(Date.now() + deadlineHours * 3600000).toLocaleDateString()}`}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </section>

        {/* Custom variables */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Custom Variables
          </h2>
          <VariableEditor variables={customVariables} onChange={setCustomVariables} />
        </section>

        {/* Status (edit only) */}
        {isEdit && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h2>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="status"
                    checked={status === o.value}
                    onChange={() => setStatus(o.value)}
                    className="mt-1 h-4 w-4 text-indigo-600"
                  />
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
        <Button onClick={() => save(false)} loading={saving}>
          {isEdit ? 'Save Project' : 'Create Project'}
        </Button>
        <Button variant="secondary" onClick={() => save(true)} loading={saving}>
          Save &amp; Add Positions
        </Button>
        <Button variant="ghost" onClick={() => router.push('/dashboard/concerts')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
