// Helper to build a Supabase server client inside Route Handlers / Server Actions.
// auth-helpers-nextjs v0.15 uses the SSR-style API (cookies adapter).
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export function createRouteClient() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return store.get(name)?.value; },
        set(name: string, value: string, options: Record<string, unknown>) {
          try { store.set({ name, value, ...options }); } catch { /* no-op in RSC */ }
        },
        remove(name: string, options: Record<string, unknown>) {
          try { store.set({ name, value: '', ...options }); } catch { /* no-op */ }
        },
      },
    },
  );
}
