import { NextResponse } from 'next/server';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

// POST /api/email/test — send a test email from the manager's connected account to themselves.
export async function POST() {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('email_address')
    .eq('manager_id', ctx.manager.id)
    .maybeSingle();
  if (!integration) {
    return NextResponse.json({ error: 'No email account connected' }, { status: 400 });
  }

  try {
    const result = await sendEmail({
      managerId: ctx.manager.id,
      to: integration.email_address,
      subject: '✓ Callscade — Your email is connected',
      body: `<p>This is a test email confirming your email account is successfully connected to Callscade.</p>
             <p>You're ready to start sending to musicians.</p>`,
    });
    return NextResponse.json({
      ok: true,
      sentTo: integration.email_address,
      messageId: result.messageId,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
