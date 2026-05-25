/**
 * POST /api/email/compose-send
 * One-shot API: creates a project + position + recipient sequence + starts cascade.
 * Powers the Gmail-like compose UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { startSending } from '@/lib/sendEngine';
import { logActivity } from '@/lib/activityLogger';

const recipientSchema = z.object({
  musician_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  rank: z.number().int().min(1).optional(),
});

const schema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Email body is required'),
  recipients: z.array(recipientSchema).min(1, 'Add at least one recipient'),
  template_id: z.string().uuid().nullable().optional(),
  accept_deadline_hours: z.number().int().min(1).max(8760).default(48),
  accept_deadline_text: z.string().max(500).nullable().optional(),
  custom_variables: z.record(z.string(), z.string()).optional(),
  save_as_draft: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const orgId = ctx.organization.id;
  const managerId = ctx.manager.id;

  // 1. Create project (concert) — named after subject
  const { data: project, error: projectErr } = await admin
    .from('concerts')
    .insert({
      organization_id: orgId,
      created_by: managerId,
      name: body.subject,
      template_id: body.template_id ?? null,
      accept_deadline_hours: body.accept_deadline_hours,
      accept_deadline_text: body.accept_deadline_text ?? null,
      custom_variables: body.custom_variables ?? {},
      status: body.save_as_draft ? 'draft' : 'active',
    })
    .select()
    .single();
  if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 });

  // 2. Create position
  const { data: position, error: posErr } = await admin
    .from('concert_positions')
    .insert({
      concert_id: project.id,
      position_name: 'Primary',
      musicians_needed: 1,
      template_id: body.template_id ?? null,
      response_deadline_type: 'days',
      response_deadline_days: Math.max(1, Math.ceil(body.accept_deadline_hours / 24)),
      auto_resend_enabled: true,
      auto_resend_days: Math.max(1, Math.ceil(body.accept_deadline_hours / 24)),
      status: 'pending',
    })
    .select()
    .single();
  if (posErr) return NextResponse.json({ error: posErr.message }, { status: 500 });

  // 3. Resolve recipients — for ad-hoc contacts, create a minimal musician record
  const resolvedIds: { musician_id: string; rank: number }[] = [];

  for (let i = 0; i < body.recipients.length; i++) {
    const r = body.recipients[i];
    let musicianId = r.musician_id ?? null;

    if (!musicianId) {
      // Ad-hoc: look up by email first to avoid duplicates
      const { data: existing } = await admin
        .from('musicians')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', r.email)
        .maybeSingle();

      if (existing) {
        musicianId = existing.id;
      } else {
        // Create a guest contact record
        const nameParts = r.name.trim().split(/\s+/);
        const firstName = nameParts[0] ?? r.name;
        const lastName = nameParts.slice(1).join(' ') || '-';
        const { data: newMusician, error: mErr } = await admin
          .from('musicians')
          .insert({
            organization_id: orgId,
            first_name: firstName,
            last_name: lastName,
            email: r.email,
            position: 'Guest',
            rank: 999,
          })
          .select('id')
          .single();
        if (mErr) return NextResponse.json({ error: `Failed to create contact: ${mErr.message}` }, { status: 500 });
        musicianId = newMusician.id;
      }
    }

    if (!musicianId) return NextResponse.json({ error: 'Could not resolve recipient' }, { status: 500 });
    resolvedIds.push({ musician_id: musicianId, rank: r.rank ?? i + 1 });
  }

  // 4. Insert recipient sequence
  const { error: seqErr } = await admin
    .from('concert_position_musicians')
    .insert(
      resolvedIds.map(({ musician_id, rank }) => ({
        concert_position_id: position.id,
        musician_id,
        rank,
        status: 'pending',
      }))
    );
  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });

  await logActivity({
    organizationId: orgId,
    managerId,
    action: 'concert_created',
    entityType: 'concert',
    entityId: project.id,
    details: { concert_name: project.name, recipient_count: body.recipients.length },
  });

  // 5. Start cascade immediately (unless saving as draft)
  if (!body.save_as_draft) {
    const result = await startSending(position.id, managerId);
    return NextResponse.json({
      ok: true,
      project_id: project.id,
      position_id: position.id,
      sent: result.sent ?? false,
      recipient_name: result.musicianName ?? null,
      reason: result.reason ?? null,
    });
  }

  return NextResponse.json({ ok: true, project_id: project.id, position_id: position.id, sent: false });
}
