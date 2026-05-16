import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const createSchema = z.object({
  name: z.string().min(1).max(200),
  dates: z.array(z.string().regex(dateRe)).min(1, 'At least one performance date is required'),
  rehearsal_dates: z.array(z.string().regex(dateRe)).optional(),
  venue: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// GET /api/concerts?status=&include_positions=&page=&limit=
export async function GET(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const includePositions = sp.get('include_positions') === 'true';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)));

  const admin = createAdminClient();
  let query = admin
    .from('concerts')
    .select('*', { count: 'exact' })
    .eq('organization_id', ctx.organization.id)
    .order('updated_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (status) query = query.eq('status', status);

  const { data: concerts, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let result = concerts ?? [];
  if (includePositions && result.length > 0) {
    const { data: positions } = await admin
      .from('concert_positions')
      .select('id, concert_id, position_name, status, musicians_needed')
      .in('concert_id', result.map((c) => c.id));
    const byConcert = new Map<string, unknown[]>();
    for (const p of positions ?? []) {
      const arr = byConcert.get(p.concert_id) ?? [];
      arr.push(p);
      byConcert.set(p.concert_id, arr);
    }
    result = result.map((c) => ({ ...c, positions: byConcert.get(c.id) ?? [] }));
  }

  return NextResponse.json({ concerts: result, total: count ?? 0, page, limit });
}

// POST /api/concerts — create a concert in draft status.
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = createSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('concerts')
    .insert({
      organization_id: ctx.organization.id,
      created_by: ctx.manager.id,
      name: body.name,
      dates: body.dates,
      rehearsal_dates: body.rehearsal_dates ?? null,
      venue: body.venue ?? null,
      notes: body.notes ?? null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ concert: data });
}
