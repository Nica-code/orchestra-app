'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, Mail, Settings, X } from 'lucide-react';

const nav = [
  { href: '/dashboard',           label: 'Dashboard', icon: Home },
  { href: '/dashboard/concerts',  label: 'Concerts',  icon: Calendar },
  { href: '/dashboard/musicians', label: 'Musicians', icon: Users },
  { href: '/dashboard/templates', label: 'Templates', icon: Mail },
];

const settingsNav = [
  { href: '/dashboard/settings/organization', label: 'Organization' },
  { href: '/dashboard/settings/managers',     label: 'Managers' },
  { href: '/dashboard/settings/email',        label: 'Email' },
  { href: '/dashboard/settings/notifications', label: 'Notifications' },
  { href: '/dashboard/settings/billing',      label: 'Billing' },
  { href: '/dashboard/settings/activity',     label: 'Activity' },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const inSettings = pathname.startsWith('/dashboard/settings');

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <span className="text-lg font-bold text-indigo-600">Orchestra</span>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                isActive(href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <div className="mt-2">
            <Link
              href="/dashboard/settings/organization"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                inSettings ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            {inSettings && (
              <div className="ml-8 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-3">
                {settingsNav.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`rounded-md px-2 py-1 text-sm ${
                      isActive(href) ? 'text-indigo-700 font-medium' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
