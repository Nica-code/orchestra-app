/**
 * Send engine — the core of FirstCall.
 * Sends ranked emails one at a time, processes responses, auto-advances.
 */
import 'server-only';
import crypto from 'node:crypto';
import { format } from 'date-fns';
import { createAdminClient } from './supabase-server';
import { sendEmail } from './email';
import { renderTemplate } from './templateEngine';
import { isMusicianAvailable } from './availability';
import { checkEmailConnection } from './emailHealth';
import { formatConcertDates } from './concertDates';
import {
  notifyAccepted, notifyDeclined, notifyNoResponse, notifyExhausted, notifySendFailed,
} from './notifications';
import type { EmailAttachment } from './mime';

type Admin = ReturnType<typeof createAdminClient>;

interface StartResult { ok: boolean; error?: string; sent?: boolean; musicianName?: string; reason?: string; }
interface SendResult { sent: boolean; reason?: string; musicianName?: string; token?: string; }
interface ResponseResult { success: boolean; action: 'accepted' | 'declined'; }
interface NoResponseResult { ok: boolean; advanced: boolean; }

function log(action: string, details: Record<string, unknown>): void {
  console.log(`[sendEngine] ${new Date().toISOString()} ${action}`, JSON.stringify(details));
}

/** Fetches position + concert + template + organization in one bundle. */
async function loadPositionContext(admin: Admin, concertPositionId: string) {
  const { data: position } = await admin
    .from('concert_positions').select('*').eq('id', concertPositionId).maybeSingle();
  if (!position) return null;
  const { data: concert } = await admin
    .from('concerts').select('*').eq('id', position.concert_id).maybeSingle();
  if (!concert) return null;
  const { data: organization } = await admin
    .from('organizations').select('*').eq('id', concert.organization_id).maybeSingle();
  if (!organization) return null;
  let template = null;
  if (position.template_id) {
    const { data } = await admin.from('email_templates').select('*').eq('id', position.template_id).maybeSingle();
    template = data;
  }
  return { position, concert, organization, template };
}

async function fetchAttachments(admin: Admin, templateId: string | null): Promise<EmailAttachment[]> {
  if (!templateId) return [];
  const { data: rows } = await admin
    .from('template_attachments').select('file_name, file_url, mime_type').eq('template_id', templateId);
  const out: EmailAttachment[] = [];
  for (const r of rows ?? []) {
    try {
      const res = await fetch(r.file_url);
      if (!res.ok) continue;
      out.push({ filename: r.file_name, content: Buffer.from(await res.arrayBuffer()), mimeType: r.mime_type });
    } catch {
      // skip an attachment that can't be fetched
    }
  }
  return out;
}

/** STEP 7.2 / Function 1 — begin sending for a position. */
export async function startSending(concertPositionId: string, managerId: string): Promise<StartResult> {
  const admin = createAdminClient();
  const ctx = await loadPositionContext(admin, concertPositionId);
  if (!ctx) return { ok: false, error: 'Position not found' };

  if (ctx.position.status !== 'pending') {
    return { ok: false, error: 'Sending already started for this position' };
  }

  const health = await checkEmailConnection(managerId);
  if (!health.connected) {
    return { ok: false, error: 'No email account connected. Connect your email in Settings → Email.' };
  }
  if (!ctx.position.template_id || !ctx.template) {
    return { ok: false, error: 'This position has no email template. Edit the position to choose one.' };
  }

  const { data: plan } = await admin.from('plans').select('send_count, send_limit')
    .eq('organization_id', ctx.organization.id).maybeSingle();
  if (plan && plan.send_count >= plan.send_limit) {
    return { ok: false, error: 'You have reached your monthly send limit. Upgrade your plan to send more.' };
  }

  await admin.from('concert_positions').update({ status: 'active' }).eq('id', concertPositionId);
  log('startSending', { concertPositionId, managerId });

  const result = await sendToNextMusician(concertPositionId, managerId, 'manual');
  if (!result.sent) {
    return { ok: true, sent: false, reason: result.reason };
  }
  return { ok: true, sent: true, musicianName: result.musicianName };
}

/** STEP 7.2 / Function 2 — send to the next eligible musician by rank. */
export async function sendToNextMusician(
  concertPositionId: string,
  managerId: string,
  triggeredBy: 'manual' | 'decline' | 'no_response' = 'manual',
): Promise<SendResult> {
  const admin = createAdminClient();
  const ctx = await loadPositionContext(admin, concertPositionId);
  if (!ctx) return { sent: false, reason: 'Position not found' };

  const { data: queue } = await admin
    .from('concert_position_musicians')
    .select('*, musicians(first_name, last_name, email, is_blacklisted)')
    .eq('concert_position_id', concertPositionId)
    .eq('status', 'pending')
    .order('rank');

  let totalContacted = 0;
  {
    const { count } = await admin.from('concert_position_musicians')
      .select('id', { count: 'exact', head: true })
      .eq('concert_position_id', concertPositionId);
    totalContacted = count ?? 0;
  }

  // Find the first eligible musician, skipping blacklisted / unavailable.
  type Row = {
    id: string; musician_id: string; rank: number;
    musicians: { first_name: string; last_name: string; email: string; is_blacklisted: boolean } | null;
  };
  let eligible: Row | null = null;
  for (const raw of (queue ?? []) as unknown as Row[]) {
    const m = raw.musicians;
    if (!m) continue;

    if (m.is_blacklisted) {
      await admin.from('concert_position_musicians')
        .update({ status: 'skipped', skip_reason: 'blacklisted' }).eq('id', raw.id);
      await admin.from('send_logs').insert({
        concert_position_id: concertPositionId,
        concert_position_musician_id: raw.id,
        musician_id: raw.musician_id,
        organization_id: ctx.organization.id,
        status: 'skipped',
        token: crypto.randomUUID(),
        token_expires_at: new Date().toISOString(),
        manager_id: managerId,
        failure_reason: 'blacklisted',
      });
      log('skip', { concertPositionId, musicianId: raw.musician_id, reason: 'blacklisted' });
      continue;
    }

    // availability across all concert dates
    let unavailableReason: string | null = null;
    for (const d of (ctx.concert.dates ?? []) as string[]) {
      const a = await isMusicianAvailable(raw.musician_id, d);
      if (!a.available) { unavailableReason = a.reason ?? 'unavailable'; break; }
    }
    if (unavailableReason) {
      await admin.from('concert_position_musicians')
        .update({ status: 'skipped', skip_reason: `unavailable: ${unavailableReason}` }).eq('id', raw.id);
      await admin.from('send_logs').insert({
        concert_position_id: concertPositionId,
        concert_position_musician_id: raw.id,
        musician_id: raw.musician_id,
        organization_id: ctx.organization.id,
        status: 'skipped',
        token: crypto.randomUUID(),
        token_expires_at: new Date().toISOString(),
        manager_id: managerId,
        failure_reason: `unavailable: ${unavailableReason}`,
      });
      log('skip', { concertPositionId, musicianId: raw.musician_id, reason: unavailableReason });
      continue;
    }

    eligible = raw;
    break;
  }

  if (!eligible || !eligible.musicians) {
    await admin.from('concert_positions').update({ status: 'exhausted' }).eq('id', concertPositionId);
    await notifyExhausted({
      managerId,
      positionName: ctx.position.position_name,
      concertName: ctx.concert.name,
      concertId: ctx.concert.id,
      totalContacted,
    });
    log('exhausted', { concertPositionId });
    return { sent: false, reason: 'exhausted' };
  }

  const musician = eligible.musicians;
  const musicianName = `${musician.first_name} ${musician.last_name}`;

  // token + expiry
  const token = crypto.randomUUID();
  let expiresAt: Date;
  if (ctx.position.response_deadline_type === 'specific_date' && ctx.position.response_deadline_date) {
    expiresAt = new Date(ctx.position.response_deadline_date);
  } else {
    const days = ctx.position.response_deadline_days ?? 2;
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const deadlineStr = format(expiresAt, "EEEE, MMMM d, yyyy 'at' h:mm a");
  const rendered = renderTemplate(
    { subject: ctx.template!.subject, body: ctx.template!.body },
    {
      name: musician.first_name,
      full_name: musicianName,
      position: ctx.position.position_name,
      concert_name: ctx.concert.name,
      date: formatConcertDates(ctx.concert.dates),
      venue: ctx.concert.venue ?? '',
      deadline: deadlineStr,
      organization_name: ctx.organization.name,
    },
    { missing: 'blank' },
  );

  const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/response/${token}`;
  const htmlBody =
    `<div style="white-space:pre-wrap">${rendered.body}</div>` +
    `<br><br><div>———————————————————</div>` +
    `<div>Please respond using the buttons on this page:</div>` +
    `<div><a href="${responseUrl}">→ Click here to accept or decline</a></div>` +
    `<div style="color:#888;font-size:12px">Please respond by ${deadlineStr}.</div>`;

  const attachments = await fetchAttachments(admin, ctx.position.template_id);

  let sendOk = true;
  let failureReason: string | null = null;
  try {
    await sendEmail({
      managerId,
      to: musician.email,
      subject: rendered.subject,
      body: htmlBody,
      attachments,
    });
  } catch (err) {
    sendOk = false;
    failureReason = err instanceof Error ? err.message : 'Unknown send error';
  }

  // send_log
  await admin.from('send_logs').insert({
    concert_position_id: concertPositionId,
    concert_position_musician_id: eligible.id,
    musician_id: eligible.musician_id,
    organization_id: ctx.organization.id,
    status: sendOk ? 'sent' : 'failed',
    token,
    token_expires_at: expiresAt.toISOString(),
    sent_at: sendOk ? new Date().toISOString() : null,
    email_subject: rendered.subject,
    email_body: htmlBody,
    manager_id: managerId,
    failure_reason: failureReason,
  });

  if (!sendOk) {
    // Do NOT advance on failure — needs manager intervention.
    log('sendFailed', { concertPositionId, musicianId: eligible.musician_id, failureReason });
    await notifySendFailed({ managerId, musicianName, concertId: ctx.concert.id });
    return { sent: false, reason: `Email failed to send: ${failureReason}` };
  }

  await admin.from('concert_position_musicians')
    .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', eligible.id);

  // increment send_count
  const { data: plan } = await admin.from('plans').select('id, send_count')
    .eq('organization_id', ctx.organization.id).maybeSingle();
  if (plan) {
    await admin.from('plans').update({ send_count: (plan.send_count ?? 0) + 1 }).eq('id', plan.id);
  }

  log('sent', { concertPositionId, musicianId: eligible.musician_id, triggeredBy, token });
  return { sent: true, musicianName, token };
}

/** STEP 7.2 / Function 3 — process an accept/decline response. */
export async function processResponse(
  token: string,
  response: 'accepted' | 'declined',
): Promise<ResponseResult> {
  const admin = createAdminClient();
  const { data: sendLog } = await admin.from('send_logs').select('*').eq('token', token).maybeSingle();
  if (!sendLog) throw new Error('Invalid response link');
  if (sendLog.token_used_at) throw new Error('This link has already been used');
  if (new Date(sendLog.token_expires_at) < new Date()) throw new Error('This response link has expired');

  const now = new Date().toISOString();
  await admin.from('send_logs')
    .update({ status: response, responded_at: now, token_used_at: now })
    .eq('id', sendLog.id);
  if (sendLog.concert_position_musician_id) {
    await admin.from('concert_position_musicians')
      .update({ status: response, responded_at: now })
      .eq('id', sendLog.concert_position_musician_id);
  }

  const ctx = sendLog.concert_position_id
    ? await loadPositionContext(admin, sendLog.concert_position_id)
    : null;
  const { data: musician } = await admin.from('musicians')
    .select('first_name, last_name, email').eq('id', sendLog.musician_id).maybeSingle();
  const musicianName = musician ? `${musician.first_name} ${musician.last_name}` : 'A musician';

  if (response === 'accepted') {
    if (sendLog.concert_position_id) {
      await admin.from('concert_positions').update({ status: 'filled' }).eq('id', sendLog.concert_position_id);
    }
    if (ctx && ctx.concert.status === 'draft') {
      await admin.from('concerts').update({ status: 'active' }).eq('id', ctx.concert.id);
    }
    if (ctx && sendLog.manager_id && musician) {
      await notifyAccepted({
        managerId: sendLog.manager_id,
        musicianName,
        musicianEmail: musician.email,
        positionName: ctx.position.position_name,
        concertName: ctx.concert.name,
        concertDate: formatConcertDates(ctx.concert.dates),
        concertId: ctx.concert.id,
      });
    }
    log('accepted', { token, musicianId: sendLog.musician_id });
    return { success: true, action: 'accepted' };
  }

  // declined
  let nextMusicianName: string | null = null;
  let autoSentToNext = false;
  if (ctx && ctx.position.auto_resend_enabled && sendLog.manager_id && sendLog.concert_position_id) {
    const next = await sendToNextMusician(sendLog.concert_position_id, sendLog.manager_id, 'decline');
    autoSentToNext = true;
    nextMusicianName = next.musicianName ?? null;
  }
  if (ctx && sendLog.manager_id) {
    await notifyDeclined({
      managerId: sendLog.manager_id,
      musicianName,
      positionName: ctx.position.position_name,
      concertName: ctx.concert.name,
      concertId: ctx.concert.id,
      nextMusicianName,
      autoSentToNext,
    });
  }
  log('declined', { token, musicianId: sendLog.musician_id, autoSentToNext });
  return { success: true, action: 'declined' };
}

/** STEP 7.2 / Function 4 — handle a send whose deadline passed with no reply. */
export async function processNoResponse(sendLogId: string): Promise<NoResponseResult> {
  const admin = createAdminClient();
  const { data: sendLog } = await admin.from('send_logs').select('*').eq('id', sendLogId).maybeSingle();
  if (!sendLog || sendLog.status !== 'sent') return { ok: false, advanced: false };

  await admin.from('send_logs').update({ status: 'no_response' }).eq('id', sendLogId);
  if (sendLog.concert_position_musician_id) {
    await admin.from('concert_position_musicians')
      .update({ status: 'no_response' }).eq('id', sendLog.concert_position_musician_id);
  }

  const ctx = sendLog.concert_position_id
    ? await loadPositionContext(admin, sendLog.concert_position_id)
    : null;
  if (!ctx || !sendLog.manager_id || !sendLog.concert_position_id) return { ok: true, advanced: false };

  const { data: musician } = await admin.from('musicians')
    .select('first_name, last_name').eq('id', sendLog.musician_id).maybeSingle();
  const musicianName = musician ? `${musician.first_name} ${musician.last_name}` : 'A musician';

  let nextMusicianName: string | null = null;
  let autoSentToNext = false;
  if (ctx.position.auto_resend_enabled) {
    const next = await sendToNextMusician(sendLog.concert_position_id, sendLog.manager_id, 'no_response');
    autoSentToNext = true;
    nextMusicianName = next.musicianName ?? null;
  }
  await notifyNoResponse({
    managerId: sendLog.manager_id,
    musicianName,
    positionName: ctx.position.position_name,
    concertName: ctx.concert.name,
    concertId: ctx.concert.id,
    nextMusicianName,
    autoSentToNext,
  });
  log('noResponse', { sendLogId, autoSentToNext });
  return { ok: true, advanced: autoSentToNext };
}

/** STEP 7.2 / Function 5 — manager manually triggers the next send. */
export async function triggerNextManually(
  concertPositionId: string,
  managerId: string,
): Promise<StartResult> {
  const admin = createAdminClient();
  const ctx = await loadPositionContext(admin, concertPositionId);
  if (!ctx) return { ok: false, error: 'Position not found' };
  if (ctx.position.status !== 'active') {
    return { ok: false, error: 'This position is not currently sending' };
  }

  // Don't advance while a send is still awaiting response.
  const { data: pending } = await admin
    .from('send_logs')
    .select('token_expires_at, musician_id')
    .eq('concert_position_id', concertPositionId)
    .eq('status', 'sent')
    .limit(1);
  if (pending && pending.length > 0) {
    const { data: m } = await admin.from('musicians')
      .select('first_name, last_name').eq('id', pending[0].musician_id).maybeSingle();
    const name = m ? `${m.first_name} ${m.last_name}` : 'the current musician';
    const deadline = format(new Date(pending[0].token_expires_at), "MMM d 'at' h:mm a");
    return {
      ok: false,
      error: `Still waiting for a response from ${name}. Their deadline is ${deadline}. ` +
        `You can wait for them to respond or for their deadline to pass.`,
    };
  }

  const result = await sendToNextMusician(concertPositionId, managerId, 'manual');
  if (!result.sent) return { ok: true, sent: false, reason: result.reason };
  return { ok: true, sent: true, musicianName: result.musicianName };
}
