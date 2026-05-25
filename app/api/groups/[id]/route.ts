import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
});

async function loadOwnedGroup(groupId: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: group, error } = await admin
    .from('recipient_groups')
    .select('*')
    .eq('id', groupId)
    .eq('organization_id', ctx.organization.id)
    .single();
  if (error || !group) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { ctx, admin, group };
}

// GET /api/groups/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await loadOwnedGroup(params.id);
  if (res.error) return res.error;
  const { admin, group } = res;

  const { data: members } = await admin!
    .from('recipient_group_members')
    .select('*')
    .eq('group_id', params.id)
    .order('rank');
  return NextResponse.json({ group: { ...group, members: members ?? [] } });
}

// PUT /api/groups/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await loadOwnedGroup(params.id);
  if (res.error) return res.error;
  const { admin } = res;

  let body;
  try { body = updateSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const { data, error } = await admin!
    .from('recipient_groups')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

// DELETE /api/groups/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await loadOwnedGroup(params.id);
  if (res.error) return res.error;
  const { admin } = res;

  const { error } = await admin!.from('recipient_groups').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
