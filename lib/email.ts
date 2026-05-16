/**
 * Unified email router — THE single entry point for sending email as a manager.
 *
 * The rest of the app (send engine, etc.) must only call sendEmail() from here,
 * never gmail.ts / outlook.ts / smtp.ts directly.
 *
 * (For system emails — invites, billing notices — use lib/resend.ts instead.)
 */
import 'server-only';
import { createAdminClient } from './supabase-server';
import { sendEmailViaGmail } from './gmail';
import { sendEmailViaOutlook } from './outlook';
import { sendEmailViaSMTP } from './smtp';
import { EmailAttachment } from './mime';

export interface SendEmailParams {
  managerId: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('provider, is_active')
    .eq('manager_id', params.managerId)
    .maybeSingle();

  if (!integration || !integration.is_active) {
    throw new Error('No email account connected. Please connect your email in Settings → Email.');
  }

  try {
    let messageId: string;
    switch (integration.provider) {
      case 'gmail':
        messageId = await sendEmailViaGmail(params);
        break;
      case 'outlook':
        messageId = await sendEmailViaOutlook(params);
        break;
      case 'smtp':
        messageId = await sendEmailViaSMTP(params);
        break;
      default:
        throw new Error(`Unknown email provider: ${integration.provider}`);
    }
    return { success: true, messageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[email] send failed (manager=${params.managerId}, to=${params.to}):`, detail);
    throw new Error(`Could not send email: ${detail}`);
  }
}
