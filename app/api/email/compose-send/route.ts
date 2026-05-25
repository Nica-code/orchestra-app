/**
 * POST /api/email/compose-send
 * One-shot: creates project + position + sequence + starts sending immediately.
 * Auto-creates a one-off template from body/subject if no template_id provided.
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
  subject:              z.string().min(1, 'Subject is required').max(500),
  body:                 z.string().min(1, 'Email body is required'),
  recipients:           z.array(recipientSchema).min(1, 'Add at least one recipient'),
  template_id:          z.string().uuid().nullable().optional(),
  accept_deadline_hours: z.number().int().min(1).max(8760).nullable().optional(),
  custom_variables:     z.record(z.string(), z.string()).optional(),
  send_mode:            z.enum(['cascade', 'broadcast']).optional().default('cascade'),
  filled_message:       z.string().max(2000).nullable().optional(),
  save_as_draft:        z.boolean().optional().default(false),
  // for updating an existing draft
  draft_project_id:     z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();
  const orgId    = ctx.organization.id;
  const managerId = ctx.manager.id;

  // If resending a draft: delete the old project first (clean slate)
  if (body.draft_project_id) {
    await admin.from('concerts').delete().eq('id', body.draft_project_id).eq('organization_id', orgId);
  }

  // Deadline: null means no expiry — use a far-future date in the engine
  const deadlineDays = body.accept_deadline_hours
    ? Math.max(1, Math.ceil(body.accept_deadline_hours / 24))
    : null;

  // 1. Resolve template — use selected template OR auto-create one-off from body/subject
  let templateId = body.template_id ?? null;
  if (!templateId) {
    const { data: autoTemplate, error: tErr } = await admin
      .from('email_templates')
      .insert({
        organization_id: orgId,
        name: `[Compose] ${body.subject.slice(0, 80)}`,
        subject: body.subject,
        body: body.body,
        is_default: false,
        // is_one_off omitted intentionally — column added by migration 016;
        // templates API already filters these out by name prefix
      })
      .select('id')
      .single();
    if (tErr) return NextResponse.json({ error: `Failed to create template: ${tErr.message}` }, { status: 500 });
    templateId = autoTemplate.id;
  }

  // 2. Create project
  const { data: project, error: projectErr } = await admin
    .from('concerts')
    .insert({
      organization_id: orgId,
      created_by:      managerId,
      name:            body.subject,
      template_id:     templateId,
      ...(body.accept_deadline_hours != null ? { accept_deadline_hours: body.accept_deadline_hours } : {}),
      custom_variables: body.custom_variables ?? {},
      filled_message:  body.filled_message ?? null,
      status:          body.save_as_draft ? 'draft' : 'active',
    })
    .select()
    .single();
  if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 });

  // 3. Create position
  const { data: position, error: posErr } = await admin
    .from('concert_positions')
    .insert({
      concert_id:              project.id,
      position_name:           'Primary',
      musicians_needed:        1,
      template_id:             templateId,
      response_deadline_type:  'days',
      response_deadline_days:  deadlineDays ?? 3650, // ~10 years if no deadline
      auto_resend_enabled:     body.send_mode === 'cascade',
      auto_resend_days:        deadlineDays ?? 3650,
      send_mode:               body.send_mode,
      status:                  'pending',
    })
    .select()
    .single();
  if (posErr) return NextResponse.json({ error: posErr.message }, { status: 500 });

  // 4. Resolve recipients
  const resolvedIds: { musician_id: string; rank: number }[] = [];

  for (let i = 0; i < body.recipients.length; i++) {
    const r = body.recipients[i];
    let musicianId = r.musician_id ?? null;

    if (!musicianId) {
      const { data: existing } = await admin
        .from('musicians')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', r.email)
        .maybeSingle();

      if (existing) {
        musicianId = existing.id;
      } else {
        const nameParts = r.name.trim().split(/\s+/);
        const { data: newMusician, error: mErr } = await admin
          .from('musicians')
          .insert({
            organization_id: orgId,
            first_name: nameParts[0] ?? r.name,
            last_name:  nameParts.slice(1).join(' ') || '-',
            email:      r.email,
            position:   '',
            rank:       999,
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

  // 5. Insert sequence
  const { error: seqErr } = await admin
    .from('concert_position_musicians')
    .insert(resolvedIds.map(({ musician_id, rank }) => ({
      concert_position_id: position.id,
      musician_id,
      rank,
      status: 'pending',
    })));
  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });

  await logActivity({
    organizationId: orgId, managerId,
    action: 'concert_created', entityType: 'concert', entityId: project.id,
    details: { concert_name: project.name, recipient_count: body.recipients.length, mode: body.send_mode },
  });

  // 6. Send immediately (unless draft)
  if (!body.save_as_draft) {
    const result = await startSending(position.id, managerId);
    return NextResponse.json({
      ok: true, project_id: project.id, position_id: position.id,
      sent: result.sent ?? false,
      recipient_name: result.musicianName ?? null,
      reason: result.reason ?? null,
    });
  }

  return NextResponse.json({ ok: true, project_id: project.id, position_id: position.id, sent: false });
}
