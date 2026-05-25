import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const updateSchema = z.object({
  first_name:    z.string().min(1).max(100).optional(),
  last_name:     z.string().min(1).max(100).optional(),
  email:         z.string().email().optional(),
  phone:         z.string().max(50).nullable().optional(),
  position:      z.string().max(120).optional(),
  rank:          z.number().int().min(1).optional(),
  notes:         z.string().max(500).nullable().optional(),
  is_blacklisted: z.boolean().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

async function loadOwned(id: string) {
  const ctx = await getCurrentManager();
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: musician } = await admin.from('musicians').select('*').eq('id', id).maybeSingle();
  if (!musician) return { error: NextResponse.json({ error: 'Musician not found' }, { status: 404 }) };
  if (musician.organization_id !== ctx.organization.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ctx, admin, musician };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, musician } = await loadOwned(params.id);
  if (error) return error;
  return NextResponse.json({ musician });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin, ctx } = await loadOwned(params.id);
  if (error) return error;

  let body;
  try { body = updateSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  if (body.email) {
    const { data: dup } = await admin!
      .from('musicians')
      .select('id')
      .eq('organization_id', ctx!.organization.id)
      .eq('email', body.email)
      .neq('id', params.id)
      .maybeSingle();
    if (dup) return NextResponse.json({ error: 'A musician with that email already exists' }, { status: 409 });
  }

  const { data, error: updErr } = await admin!
    .from('musicians')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ musician: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, admin } = await loadOwned(params.id);
  if (error) return error;

  // Guard: don't delete a musician with an active send in progress.
  // concert_position_musicians arrives in Part 7; query defensively.
  try {
    const { data: active } = await admin!
      .from('concert_position_musicians')
      .select('id, status')
      .eq('musician_id', params.id)
      .in('status', ['queued', 'sent'])
      .limit(1);
    if (active && active.length > 0) {
      return NextResponse.json({ error: 'Cannot delete musician with active send in progress' }, { status: 409 });
    }
  } catch {
    // table doesn't exist yet — no active sends possible
  }

  const { error: delErr } = await admin!.from('musicians').delete().eq('id', params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
