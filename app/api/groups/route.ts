import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
});

// GET /api/groups — list all recipient groups for the org
export async function GET(_req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: groups, error } = await admin
    .from('recipient_groups')
    .select('*')
    .eq('organization_id', ctx.organization.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach member counts
  const ids = (groups ?? []).map((g) => g.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: members } = await admin
      .from('recipient_group_members')
      .select('group_id')
      .in('group_id', ids);
    for (const m of members ?? []) {
      counts[m.group_id] = (counts[m.group_id] ?? 0) + 1;
    }
  }

  const result = (groups ?? []).map((g) => ({ ...g, member_count: counts[g.id] ?? 0 }));
  return NextResponse.json({ groups: result });
}

// POST /api/groups — create a new recipient group
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = createSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('recipient_groups')
    .insert({ organization_id: ctx.organization.id, name: body.name, description: body.description ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data }, { status: 201 });
}
