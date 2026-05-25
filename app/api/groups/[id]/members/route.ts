import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const addSchema = z.object({
  musician_id: z.string().uuid().nullable().optional(), // null = ad-hoc
  name: z.string().min(1).max(200),
  email: z.string().email(),
});

const reorderSchema = z.object({
  // Array of { id, rank } to bulk-update ordering
  members: z.array(z.object({ id: z.string().uuid(), rank: z.number().int().min(0) })),
});

async function verifyGroupOwnership(groupId: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: group } = await admin
    .from('recipient_groups')
    .select('id')
    .eq('id', groupId)
    .eq('organization_id', ctx.organization.id)
    .single();
  if (!group) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { ctx, admin };
}

// POST /api/groups/[id]/members — add a member
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await verifyGroupOwnership(params.id);
  if (res.error) return res.error;
  const { admin } = res;

  let body;
  try { body = addSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  // Determine next rank
  const { data: existing } = await admin!
    .from('recipient_group_members')
    .select('rank')
    .eq('group_id', params.id)
    .order('rank', { ascending: false })
    .limit(1);
  const nextRank = (existing?.[0]?.rank ?? -1) + 1;

  const { data, error } = await admin!
    .from('recipient_group_members')
    .insert({
      group_id: params.id,
      musician_id: body.musician_id ?? null,
      name: body.name,
      email: body.email,
      rank: nextRank,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'This email is already in the group' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ member: data }, { status: 201 });
}

// PATCH /api/groups/[id]/members — reorder members
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await verifyGroupOwnership(params.id);
  if (res.error) return res.error;
  const { admin } = res;

  let body;
  try { body = reorderSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  // Update each member's rank
  await Promise.all(
    body.members.map(({ id, rank }) =>
      admin!.from('recipient_group_members').update({ rank }).eq('id', id).eq('group_id', params.id)
    )
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id]/members?memberId=xxx — remove a member
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await verifyGroupOwnership(params.id);
  if (res.error) return res.error;
  const { admin } = res;

  const memberId = req.nextUrl.searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  const { error } = await admin!
    .from('recipient_group_members')
    .delete()
    .eq('id', memberId)
    .eq('group_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
