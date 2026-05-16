import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const schema = z.object({
  ranks: z.array(z.object({
    id: z.string().uuid(),
    rank: z.number().int().min(1),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const ids = body.ranks.map((r) => r.id);

  // Verify every musician belongs to the requesting organization
  const { data: owned, error: checkErr } = await admin
    .from('musicians')
    .select('id')
    .eq('organization_id', ctx.organization.id)
    .in('id', ids);
  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 });
  if ((owned?.length ?? 0) !== ids.length) {
    return NextResponse.json({ error: 'One or more musicians do not belong to your organization' }, { status: 403 });
  }

  // Apply rank updates. Supabase has no multi-row transaction over the REST API;
  // updates are applied sequentially and any failure is reported.
  for (const { id, rank } of body.ranks) {
    const { error } = await admin.from('musicians').update({ rank }).eq('id', id);
    if (error) return NextResponse.json({ error: `Failed to update rank: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: body.ranks.length });
}
