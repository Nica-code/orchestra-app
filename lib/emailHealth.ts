import 'server-only';
import { createAdminClient } from './supabase-server';
import { decrypt } from './crypto';

export interface EmailHealth {
  connected: boolean;
  provider: string | null;
  email: string | null;
  connected_at: string | null;
  /** 'ok' | 'needs_refresh' | 'error' — only meaningful when connected */
  state: 'ok' | 'needs_refresh' | 'error' | 'none';
  error: string | null;
}

/**
 * Reports the health of a manager's email connection.
 * - Gmail/Outlook: checks token expiry (expired = needs_refresh, auto-handled on send)
 * - SMTP: checks config exists and the password decrypts
 */
export async function checkEmailConnection(managerId: string): Promise<EmailHealth> {
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('*')
    .eq('manager_id', managerId)
    .maybeSingle();

  if (!integration || !integration.is_active) {
    return { connected: false, provider: null, email: null, connected_at: null, state: 'none', error: null };
  }

  const base = {
    connected: true,
    provider: integration.provider as string,
    email: integration.email_address as string,
    connected_at: integration.connected_at as string,
  };

  if (integration.provider === 'gmail' || integration.provider === 'outlook') {
    if (!integration.refresh_token) {
      return { ...base, state: 'error', error: 'Missing refresh token — please reconnect' };
    }
    const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
    if (expiresAt <= Date.now()) {
      return { ...base, state: 'needs_refresh', error: null };
    }
    return { ...base, state: 'ok', error: null };
  }

  // SMTP
  if (!integration.smtp_password_encrypted || !integration.smtp_password_iv) {
    return { ...base, state: 'error', error: 'SMTP password is missing — please reconfigure' };
  }
  try {
    decrypt(integration.smtp_password_encrypted, integration.smtp_password_iv);
  } catch {
    return { ...base, state: 'error', error: 'SMTP password could not be decrypted — please reconfigure' };
  }
  return { ...base, state: 'ok', error: null };
}
