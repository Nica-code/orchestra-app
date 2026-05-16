import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { getOrCreatePreferences } from '@/lib/notifications';

export const runtime = 'nodejs';

const bool = z.boolean();
const updateSchema = z.object({
  accepted_email: bool, accepted_inapp: bool,
  declined_email: bool, declined_inapp: bool,
  no_response_email: bool, no_response_inapp: bool,
  exhausted_email: bool, exhausted_inapp: bool,
  limit_warning_email: bool, limit_warning_inapp: bool,
}).partial();

// GET — current manager's preferences (created with defaults if missing).
export async function GET() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const preferences = await getOrCreatePreferences(ctx.manager.id);
  return NextResponse.json({ preferences });
}

// PUT — update the current manager's preferences.
export async function PUT(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = updateSchema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  await getOrCreatePreferences(ctx.manager.id); // ensure a row exists
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('notification_preferences')
    .update(body)
    .eq('manager_id', ctx.manager.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
