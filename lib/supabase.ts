// Browser-safe Supabase client. Safe to import from "use client" components.
import { createBrowserClient as createSSRBrowserClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const createBrowserClient = () =>
  createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
