// Server-only Supabase clients. NEVER import from client components.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server component / Route handler client. Reads & writes the session cookie.
export const createServerClient = () => {
  const store = cookies();
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return store.get(name)?.value; },
      set(name: string, value: string, options: Record<string, unknown>) {
        try { store.set({ name, value, ...options }); } catch { /* no-op in RSC */ }
      },
      remove(name: string, options: Record<string, unknown>) {
        try { store.set({ name, value: '', ...options }); } catch { /* no-op */ }
      },
    },
  });
};

// Service-role client for privileged server-side ops. Bypasses RLS.
export const createAdminClient = () =>
  createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
