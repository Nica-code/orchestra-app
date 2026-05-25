'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, X, CheckCircle2, XCircle, Clock, AlertTriangle, Info, CreditCard, BarChart3,
} from 'lucide-react';
import type { Notification } from '@/types';

const ICONS: Record<string, { Icon: typeof Bell; cls: string }> = {
  send_accepted: { Icon: CheckCircle2, cls: 'text-green-600' },
  send_declined: { Icon: XCircle, cls: 'text-red-600' },
  send_no_response: { Icon: Clock, cls: 'text-slate-500' },
  position_exhausted: { Icon: AlertTriangle, cls: 'text-red-600' },
  send_failed: { Icon: AlertTriangle, cls: 'text-orange-500' },
  trial_ending: { Icon: Info, cls: 'text-blue-600' },
  payment_failed: { Icon: CreditCard, cls: 'text-red-600' },
  send_limit_warning: { Icon: BarChart3, cls: 'text-yellow-600' },
  send_limit_reached: { Icon: BarChart3, cls: 'text-red-600' },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function NotificationPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p: number) => {
    setLoading(true);
    fetch(`/api/notifications?page=${p}&limit=20`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setItems((prev) => (p === 1 ? d.notifications : [...prev, ...d.notifications]));
        setUnread(d.unread ?? 0);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1); }, [load]);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    onChanged();
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      onChanged();
    }
    if (n.action_url) { router.push(n.action_url); onClose(); }
  };

  return (
    <div className="flex max-h-[500px] w-full flex-col sm:w-[380px]">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">Notifications</p>
          {unread > 0 && <p className="text-xs text-slate-500">{unread} unread</p>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:underline">
              Mark all as read
            </button>
          )}
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && !loading ? (
          <div className="px-4 py-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">No notifications yet</p>
            <p className="text-xs text-slate-400">You&apos;ll be notified here when contacts respond</p>
          </div>
        ) : (
          items.map((n) => {
            const meta = ICONS[n.type] ?? { Icon: Bell, cls: 'text-slate-400' };
            const Icon = meta.Icon;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                  n.read ? '' : 'border-l-2 border-l-indigo-500 bg-indigo-50/40'
                }`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.cls}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {items.length < total && (
        <button
          onClick={() => { const next = page + 1; setPage(next); load(next); }}
          className="border-t border-slate-200 py-2.5 text-sm font-medium text-indigo-600 hover:bg-slate-50"
        >
          {loading ? 'Loading…' : 'Load more notifications'}
        </button>
      )}
    </div>
  );
}
