// Manager-facing notification emails. Sent via Resend (system email),
// NOT the manager's connected Gmail/Outlook.
import 'server-only';
import { sendEmail as sendSystemEmail } from './resend';
import { createAdminClient } from './supabase-server';

function fromAddress(): string {
  return process.env.NOTIFY_FROM_EMAIL || 'FirstCall <onboarding@resend.dev>';
}
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

async function managerEmail(managerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('managers').select('email').eq('id', managerId).maybeSingle();
  return data?.email ?? null;
}

function concertLink(concertId: string): string {
  return `${appUrl()}/dashboard/concerts/${concertId}`;
}

export async function notifyAccepted(params: {
  managerId: string;
  musicianName: string;
  musicianEmail: string;
  positionName: string;
  concertName: string;
  concertDate: string;
  concertId: string;
}): Promise<void> {
  const to = await managerEmail(params.managerId);
  if (!to) return;
  await sendSystemEmail({
    from: fromAddress(),
    to,
    reply_to: params.musicianEmail,
    subject: `✓ ${params.concertName} — ${params.positionName} has been filled`,
    html: `<p>Great news!</p>
      <p><strong>${params.musicianName}</strong> has accepted the ${params.positionName} position for
      <strong>${params.concertName}</strong> on ${params.concertDate}.</p>
      <p>You can reply directly to this email to contact them.</p>
      <p><a href="${concertLink(params.concertId)}">→ View Concert</a></p>`,
  });
}

function autoSentLine(autoSentToNext: boolean, nextMusicianName: string | null): string {
  if (autoSentToNext && nextMusicianName) {
    return `<p>An email has automatically been sent to <strong>${nextMusicianName}</strong>.</p>`;
  }
  if (autoSentToNext && !nextMusicianName) {
    return `<p>There are no more musicians on the list. All available musicians have been contacted.</p>`;
  }
  return `<p>Log in to send to the next musician on the list.</p>`;
}

export async function notifyDeclined(params: {
  managerId: string;
  musicianName: string;
  positionName: string;
  concertName: string;
  concertId: string;
  nextMusicianName: string | null;
  autoSentToNext: boolean;
}): Promise<void> {
  const to = await managerEmail(params.managerId);
  if (!to) return;
  await sendSystemEmail({
    from: fromAddress(),
    to,
    subject: `${params.concertName} — ${params.musicianName} declined ${params.positionName}`,
    html: `<p><strong>${params.musicianName}</strong> has declined the ${params.positionName} position for
      <strong>${params.concertName}</strong>.</p>
      ${autoSentLine(params.autoSentToNext, params.nextMusicianName)}
      <p><a href="${concertLink(params.concertId)}">→ View Concert</a></p>`,
  });
}

export async function notifyNoResponse(params: {
  managerId: string;
  musicianName: string;
  positionName: string;
  concertName: string;
  concertId: string;
  nextMusicianName: string | null;
  autoSentToNext: boolean;
}): Promise<void> {
  const to = await managerEmail(params.managerId);
  if (!to) return;
  await sendSystemEmail({
    from: fromAddress(),
    to,
    subject: `${params.concertName} — No response from ${params.musicianName} for ${params.positionName}`,
    html: `<p><strong>${params.musicianName}</strong> did not respond to the ${params.positionName} request for
      <strong>${params.concertName}</strong> by the deadline.</p>
      ${autoSentLine(params.autoSentToNext, params.nextMusicianName)}
      <p><a href="${concertLink(params.concertId)}">→ View Concert</a></p>`,
  });
}

export async function notifyExhausted(params: {
  managerId: string;
  positionName: string;
  concertName: string;
  concertId: string;
  totalContacted: number;
}): Promise<void> {
  const to = await managerEmail(params.managerId);
  if (!to) return;
  await sendSystemEmail({
    from: fromAddress(),
    to,
    subject: `⚠ ${params.concertName} — No musicians available for ${params.positionName}`,
    html: `<p>All ${params.totalContacted} musicians on your list for <strong>${params.positionName}</strong>
      have been contacted for <strong>${params.concertName}</strong>, but none are available.</p>
      <p>You may need to find a musician outside your current list.</p>
      <p><a href="${concertLink(params.concertId)}">→ View Concert</a></p>`,
  });
}

export async function notifySendFailed(params: {
  managerId: string;
  musicianName: string;
  concertId: string;
}): Promise<void> {
  const to = await managerEmail(params.managerId);
  if (!to) return;
  await sendSystemEmail({
    from: fromAddress(),
    to,
    subject: `Email to ${params.musicianName} failed to send`,
    html: `<p>The email to <strong>${params.musicianName}</strong> failed to send.</p>
      <p>Please check your email connection in <a href="${appUrl()}/dashboard/settings/email">Settings → Email</a>,
      then resume sending.</p>
      <p><a href="${concertLink(params.concertId)}">→ View Concert</a></p>`,
  });
}
