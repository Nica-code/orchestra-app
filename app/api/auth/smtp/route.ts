import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { encrypt } from '@/lib/crypto';
import { buildTransportFromConfig } from '@/lib/smtp';

export const runtime = 'nodejs';

const schema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1),
  password: z.string().min(1),
  from_email: z.string().email(),
  from_name: z.string().max(120).optional(),
});

// POST /api/auth/smtp — test the SMTP connection, then store the config.
export async function POST(req: NextRequest) {
  const ctx = await getCurrentManager();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'Invalid input', details: (e as z.ZodError).issues }, { status: 400 }); }

  // 1. Verify the connection and send a test email before saving
  try {
    const transport = buildTransportFromConfig({
      host: body.host, port: body.port, secure: body.secure,
      username: body.username, password: body.password,
    });
    await transport.verify();
    await transport.sendMail({
      from: body.from_name ? `"${body.from_name}" <${body.from_email}>` : body.from_email,
      to: body.from_email,
      subject: '✓ Callscade — SMTP test',
      html: '<p>Your SMTP configuration works. You can save it now.</p>',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `SMTP connection failed: ${msg}` }, { status: 400 });
  }

  // 2. Encrypt the password and store the config
  const { encrypted, iv } = encrypt(body.password);
  const admin = createAdminClient();
  const { error } = await admin.from('email_integrations').upsert({
    manager_id: ctx.manager.id,
    organization_id: ctx.organization.id,
    provider: 'smtp',
    email_address: body.from_email,
    access_token: null, refresh_token: null, token_expires_at: null,
    smtp_host: body.host,
    smtp_port: body.port,
    smtp_secure: body.secure,
    smtp_username: body.username,
    smtp_password_encrypted: encrypted,
    smtp_password_iv: iv,
    smtp_from_name: body.from_name ?? null,
    is_active: true,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'manager_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tested: true });
}
