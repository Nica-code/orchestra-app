import { redirect } from 'next/navigation';
import { createServerClient, createAdminClient } from './supabase-server';
import type { Manager, Organization, Plan } from '@/types';

export async function getSession() {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentManager(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  manager: Manager;
  organization: Organization;
  plan: Plan;
} | null> {
  const session = await getSession();
  if (!session) return null;

  const admin = createAdminClient();

  const { data: manager } = await admin
    .from('managers')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!manager) return null;

  const [{ data: organization }, { data: plan }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', manager.organization_id).single(),
    admin.from('plans').select('*').eq('organization_id', manager.organization_id).single(),
  ]);

  if (!organization || !plan) return null;
  return { session, manager, organization, plan };
}

export async function requireManager() {
  const ctx = await getCurrentManager();
  if (!ctx) redirect('/auth/login');
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireManager();
  if (ctx.manager.role !== 'admin') {
    throw new Error('Forbidden: admin role required');
  }
  return ctx;
}
