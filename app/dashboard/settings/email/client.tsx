'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { EmailHealth } from '@/lib/emailHealth';

const PROVIDER_LABEL: Record<string, string> = {
  gmail: 'Gmail / Google Workspace',
  outlook: 'Outlook / Microsoft 365',
  smtp: 'SMTP (Other provider)',
};

function CallbackToast() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const status = params.get('status');
    const message = params.get('message');
    if (status === 'connected') toast.success(message || 'Email connected');
    else if (status === 'error') toast.error(message || 'Connection failed');
    if (status) router.replace('/dashboard/settings/email');
  }, [params, router]);
  return null;
}

export function EmailSettingsClient({ initialHealth }: { initialHealth: EmailHealth }) {
  const router = useRouter();
  const [health, setHealth] = useState<EmailHealth>(initialHealth);
  const [testing, setTesting] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refreshHealth = async () => {
    const h = await fetch('/api/email/health').then((r) => r.json()).catch(() => null);
    if (h && !h.error) setHealth(h);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/email/test', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Test failed'); return; }
      toast.success(`Test email sent to ${body.sentTo}. Check your inbox.`);
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    const res = await fetch('/api/email/disconnect', { method: 'POST' });
    if (!res.ok) { toast.error('Failed to disconnect'); return; }
    toast.success('Email disconnected');
    setHealth({ connected: false, provider: null, email: null, connected_at: null, state: 'none', error: null });
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={null}><CallbackToast /></Suspense>

      {!health.connected ? (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Connect Your Email Account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Emails to musicians will be sent from your connected account, so replies land in your real inbox.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ProviderCard
              title="Gmail or Google Workspace"
              description="Best for @gmail.com or Google Workspace accounts"
              action={<a href="/api/auth/gmail"><Button className="w-full">Connect Gmail</Button></a>}
            />
            <ProviderCard
              title="Outlook or Microsoft 365"
              description="Best for Outlook.com or Office 365 accounts"
              action={<a href="/api/auth/outlook"><Button className="w-full">Connect Outlook</Button></a>}
            />
            <ProviderCard
              title="Other Email Provider"
              description="For Yahoo, custom hosted email, or any other provider"
              action={<Button variant="secondary" className="w-full" onClick={() => setSmtpOpen(true)}>Configure SMTP</Button>}
            />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Email Account</h1>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                  <Mail className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{health.email}</p>
                  <p className="text-sm text-slate-500">{PROVIDER_LABEL[health.provider ?? ''] ?? health.provider}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                <Check className="h-3.5 w-3.5" /> Connected
              </span>
            </div>

            {health.connected_at && (
              <p className="mt-3 text-xs text-slate-400">
                Connected {new Date(health.connected_at).toLocaleDateString()}
              </p>
            )}

            <HealthIndicator state={health.state} error={health.error} />

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={sendTest} loading={testing}>Send Test Email</Button>
              <Button variant="secondary" onClick={refreshHealth}>Re-check connection</Button>
              <Button variant="danger" onClick={() => setConfirmDisconnect(true)}>Disconnect</Button>
            </div>
          </div>
        </>
      )}

      <SmtpModal open={smtpOpen} onClose={() => setSmtpOpen(false)} onSaved={() => { setSmtpOpen(false); router.refresh(); }} />

      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={disconnect}
        title="Disconnect email"
        message="Disconnect this email account? You won't be able to send to musicians until you reconnect."
        confirmLabel="Disconnect"
        danger
      />
    </div>
  );
}

function ProviderCard({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
      <Mail className="h-6 w-6 text-indigo-500" />
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 flex-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function HealthIndicator({ state, error }: { state: EmailHealth['state']; error: string | null }) {
  if (state === 'ok') {
    return <p className="mt-3 flex items-center gap-1.5 text-sm text-green-700"><Check className="h-4 w-4" /> Connected and working</p>;
  }
  if (state === 'needs_refresh') {
    return <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Token needs refresh — this happens automatically on next send</p>;
  }
  if (state === 'error') {
    return <p className="mt-3 flex items-center gap-1.5 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> Connection error{error ? `: ${error}` : ''} — please reconnect</p>;
  }
  return null;
}

function SmtpModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    host: '', port: 465, secure: true, username: '', password: '', from_email: '', from_name: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.host || !form.username || !form.password || !form.from_email) {
      toast.error('Host, username, password and from email are required'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: form.host, port: Number(form.port), secure: form.secure,
          username: form.username, password: form.password,
          from_email: form.from_email, from_name: form.from_name || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'SMTP setup failed'); return; }
      toast.success('SMTP connected — test email sent');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Configure SMTP" maxWidth="max-w-lg">
      <div className="space-y-3">
        <Input label="SMTP Host" placeholder="smtp.example.com" value={form.host} onChange={(e) => set('host', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Port" type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={form.secure} onChange={(e) => set('secure', e.target.checked)} className="h-4 w-4" />
            Secure (SSL/TLS — port 465)
          </label>
        </div>
        <Input label="Username" value={form.username} onChange={(e) => set('username', e.target.value)} />
        <Input label="Password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
        <Input label="From Email" type="email" value={form.from_email} onChange={(e) => set('from_email', e.target.value)} />
        <Input label="From Name (optional)" value={form.from_name} onChange={(e) => set('from_name', e.target.value)} />
        <p className="text-xs text-slate-500">Saving will send a test email to verify the connection before storing your config.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Test &amp; Save</Button>
        </div>
      </div>
    </Modal>
  );
}
