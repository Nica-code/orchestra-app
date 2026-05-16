'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [shake, setShake] = useState(false);
  const prevUnread = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchCount = () => {
    fetch('/api/notifications/count')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.unread !== 'number') return;
        if (d.unread > prevUnread.current) {
          setShake(true);
          setTimeout(() => setShake(false), 800);
        }
        prevUnread.current = d.unread;
        setUnread(d.unread);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, 60000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className={`h-5 w-5 ${shake ? 'animate-bounce' : ''}`} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-sm:fixed max-sm:inset-x-2 max-sm:right-2 rounded-lg border border-slate-200 bg-white shadow-xl">
          <NotificationPanel onClose={() => setOpen(false)} onChanged={fetchCount} />
        </div>
      )}
    </div>
  );
}
