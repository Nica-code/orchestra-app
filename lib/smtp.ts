// SMTP fallback integration (Yahoo, custom hosted email, etc.) via nodemailer.
import 'server-only';
import nodemailer, { Transporter } from 'nodemailer';
import { createAdminClient } from './supabase-server';
import { decrypt } from './crypto';
import { EmailAttachment } from './mime';

/** Builds and verifies a nodemailer transport from stored SMTP config. */
export async function createSmtpTransport(managerId: string): Promise<{ transport: Transporter; fromEmail: string; fromName: string | null }> {
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('*')
    .eq('manager_id', managerId)
    .eq('provider', 'smtp')
    .maybeSingle();
  if (!integration) throw new Error('No SMTP account connected');
  if (!integration.smtp_host || !integration.smtp_port || !integration.smtp_username) {
    throw new Error('SMTP configuration is incomplete');
  }
  if (!integration.smtp_password_encrypted || !integration.smtp_password_iv) {
    throw new Error('SMTP password is missing');
  }

  let password: string;
  try {
    password = decrypt(integration.smtp_password_encrypted, integration.smtp_password_iv);
  } catch {
    throw new Error('Could not decrypt SMTP password — please reconfigure SMTP');
  }

  const transport = nodemailer.createTransport({
    host: integration.smtp_host,
    port: integration.smtp_port,
    secure: !!integration.smtp_secure,
    auth: { user: integration.smtp_username, pass: password },
  });

  await transport.verify();
  return { transport, fromEmail: integration.email_address, fromName: integration.smtp_from_name };
}

/** Builds a transport directly from raw config (used to test before saving). */
export function buildTransportFromConfig(cfg: {
  host: string; port: number; secure: boolean; username: string; password: string;
}): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.username, pass: cfg.password },
  });
}

export async function sendEmailViaSMTP(params: {
  managerId: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<string> {
  try {
    const { transport, fromEmail, fromName } = await createSmtpTransport(params.managerId);
    const info = await transport.sendMail({
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.body,
      replyTo: params.replyTo,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.mimeType,
      })),
    });
    return info.messageId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown SMTP error';
    throw new Error(`Failed to send via SMTP: ${msg}`);
  }
}
