'use client';

import { Menu, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { NotificationBell } from './NotificationBell';

interface Props {
  organizationName: string;
  logoUrl: string | null;
  managerEmail: string;
  onMenu: () => void;
}

export function Header({ organizationName, logoUrl, managerEmail, onMenu }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 rounded object-cover" />}
        <span className="font-semibold text-slate-900">{organizationName}</span>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <span className="hidden text-sm text-slate-600 sm:inline">{managerEmail}</span>
        <button
          onClick={handleLogout}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
