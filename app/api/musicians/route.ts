import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const createSchema = z.object({
  first_name:    z.string().min(1).max(100),
  last_name:     z.string().min(1).max(100),
  email:         z.string().email(),
  phone:         z.string().max(50).nullable().optional(),
  position:      z.string().max(120).optional().default(''),
  rank:          z.number().int().min(1).optional().default(999),
  notes:         z.string().max(500).nullable().optional(),
  is_blacklisted: z.boolean().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional().default({}),
});

// GET /api/musicians?search=&position=&status=&sort=&page=&limit=
export async function GET(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const search = sp.get('search')?.trim() ?? '';
  const position = sp.get('position') ?? '';
  const status = sp.get('status') ?? 'all'; // all | active | blacklisted | has_notes | unavailable
  const sort = sp.get('sort') ?? 'rank';   // rank | name | position
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)));

  const admin = createAdminClient();
  let query = admin
    .from('musicians')
    .select('*', { count: 'exact' })
    .eq('organization_id', ctx.organization.id);

  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (position) query = query.eq('position', position);
  if (status === 'active') query = query.eq('is_blacklisted', false);
  if (status === 'blacklisted') query = query.eq('is_blacklisted', true);
  if (status === 'has_notes') query = query.not('notes', 'is', null);

  if (sort === 'name') query = query.order('last_name').order('first_name');
  else if (sort === 'position') query = query.order('position').order('rank');
  else query = query.order('position').order('rank');

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Annotate with current-availability status
  const ids = (data ?? []).map((m) => m.id);
  let unavailableSet = new Set<string>();
  if (ids.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: windows } = await admin
      .from('musician_availability')
      .select('musician_id, start_date, end_date')
      .in('musician_id', ids)
      .lte('start_date', today)
      .gte('end_date', today);
    unavailableSet = new Set((windows ?? []).map((w) => w.musician_id));
  }

  let musicians = (data ?? []).map((m) => ({
    ...m,
    currently_unavailable: unavailableSet.has(m.id),
    has_notes: !!m.notes,
  }));
  if (status === 'unavailable') musicians = musicians.filter((m) => m.currently_unavailable);

  return NextResponse.json({ musicians, total: count ?? 0, page, limit });
}

// POST /api/musicians
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = createSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const { data: dup } = await admin
    .from('musicians')
    .select('id')
    .eq('organization_id', ctx.organization.id)
    .eq('email', body.email)
    .maybeSingle();
  if (dup) return NextResponse.json({ error: 'A musician with that email already exists' }, { status: 409 });

  const { data, error } = await admin
    .from('musicians')
    .insert({ ...body, organization_id: ctx.organization.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ musician: data });
}
