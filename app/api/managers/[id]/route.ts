import { NextRequest, NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  if (params.id === ctx.manager.id) return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });

  const admin = createAdminClient();
  const { data: target } = await admin.from('managers').select('id, organization_id').eq('id', params.id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
  if (target.organization_id !== ctx.organization.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await admin.from('managers').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
