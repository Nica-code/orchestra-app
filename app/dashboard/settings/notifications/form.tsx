'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import type { NotificationPreferences } from '@/types';

type PrefKey = keyof Omit<NotificationPreferences, 'id' | 'manager_id' | 'created_at' | 'updated_at'>;

interface Row {
  label: string;
  emailKey: PrefKey | null; // null = critical, cannot disable
  inappKey: PrefKey | null;
  note?: string;
}

const ROWS: Row[] = [
  { label: 'Contact Accepted', emailKey: 'accepted_email', inappKey: 'accepted_inapp' },
  { label: 'Contact Declined', emailKey: 'declined_email', inappKey: 'declined_inapp' },
  { label: 'No Response (deadline passed)', emailKey: 'no_response_email', inappKey: 'no_response_inapp' },
  { label: 'Position Exhausted', emailKey: 'exhausted_email', inappKey: 'exhausted_inapp' },
  { label: 'Email Send Failed', emailKey: null, inappKey: null, note: 'Send failure alerts cannot be disabled' },
  { label: 'Monthly Send Limit Warning (80%)', emailKey: 'limit_warning_email', inappKey: 'limit_warning_inapp' },
  { label: 'Trial Ending Reminder', emailKey: null, inappKey: null, note: 'Trial reminders cannot be disabled' },
  { label: 'Payment Failed', emailKey: null, inappKey: null, note: 'Payment alerts cannot be disabled' },
];

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-slate-300'
      } ${disabled ? 'opacity-50' : ''}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function NotificationPreferencesForm({ preferences }: { preferences: NotificationPreferences }) {
  const [prefs, setPrefs] = useState(preferences);
  const [saving, setSaving] = useState(false);

  const set = (key: PrefKey, value: boolean) => setPrefs((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, boolean> = {};
      const keys: PrefKey[] = [
        'accepted_email', 'accepted_inapp', 'declined_email', 'declined_inapp',
        'no_response_email', 'no_response_inapp', 'exhausted_email', 'exhausted_inapp',
        'limit_warning_email', 'limit_warning_inapp',
      ];
      for (const k of keys) payload[k] = prefs[k];
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const b = await res.json(); toast.error(b.error || 'Save failed'); return; }
      toast.success('Preferences saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Notification</th>
            <th className="px-4 py-3 text-center">Email</th>
            <th className="px-4 py-3 text-center">In-App</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{row.label}</p>
                {row.note && <p className="text-xs text-slate-400">{row.note}</p>}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex justify-center">
                  <Toggle
                    checked={row.emailKey ? prefs[row.emailKey] : true}
                    disabled={!row.emailKey}
                    onChange={row.emailKey ? (v) => set(row.emailKey!, v) : undefined}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex justify-center">
                  <Toggle
                    checked={row.inappKey ? prefs[row.inappKey] : true}
                    disabled={!row.inappKey}
                    onChange={row.inappKey ? (v) => set(row.inappKey!, v) : undefined}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-200 p-4">
        <Button onClick={save} loading={saving}>Save Preferences</Button>
      </div>
    </div>
  );
}
