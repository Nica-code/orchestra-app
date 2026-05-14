import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { managerLimit } from '@/lib/plans';
import { sendEmail } from '@/lib/resend';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager']).default('manager'),
});

export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.manager.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  const admin = createAdminClient();

  // Plan-limit enforcement: count active + pending managers + outstanding (unaccepted, unexpired) invites
  const orgId = ctx.organization.id;
  const limit = managerLimit(ctx.plan.plan_type);
  const [{ count: managerCount }, { count: pendingCount }] = await Promise.all([
    admin.from('managers').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    admin.from('manager_invites').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).is('accepted_at', null).gt('expires_at', new Date().toISOString()),
  ]);
  const used = (managerCount ?? 0) + (pendingCount ?? 0);
  if (used >= limit) {
    return NextResponse.json({
      error: ctx.plan.plan_type === 'starter' ? 'Upgrade to Pro to add more managers' : 'Manager limit reached',
    }, { status: 402 });
  }

  // Reject duplicate active manager
  const { data: existing } = await admin.from('managers').select('id').eq('organization_id', orgId).eq('email', body.email).maybeSingle();
  if (existing) return NextResponse.json({ error: 'That email is already a manager' }, { status: 409 });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insErr } = await admin.from('manager_invites').insert({
    organization_id: orgId,
    email: body.email,
    role: body.role,
    token,
    expires_at: expiresAt,
    invited_by: ctx.manager.id,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const acceptUrl = `${appUrl}/auth/accept-invite?token=${token}`;
  try {
    await sendEmail({
      to: body.email,
      subject: `You're invited to join ${ctx.organization.name} on Orchestra App`,
      html: `
        <p>Hi,</p>
        <p><strong>${ctx.manager.email}</strong> invited you to join <strong>${ctx.organization.name}</strong> on Orchestra App as a ${body.role}.</p>
        <p><a href="${acceptUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">Accept invitation</a></p>
        <p>Or copy this link: <br>${acceptUrl}</p>
        <p>This invite expires in 7 days.</p>
      `,
    });
  } catch (e) {
    console.error('[invite-email] failed:', e);
    // Keep invite row; user can resend later
  }

  return NextResponse.json({ ok: true });
}
