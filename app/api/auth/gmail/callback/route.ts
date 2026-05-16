import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { createOAuthClient } from '@/lib/gmail';

export const runtime = 'nodejs';

function settingsRedirect(req: NextRequest, status: 'connected' | 'error', message?: string) {
  const url = new URL('/dashboard/settings/email', req.url);
  url.searchParams.set('status', status);
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}

// GET /api/auth/gmail/callback — handle Google's OAuth redirect.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');

  if (oauthError) return settingsRedirect(req, 'error', `Google denied access: ${oauthError}`);
  if (!code) return settingsRedirect(req, 'error', 'Missing authorization code');

  const ctx = await getCurrentManager();
  if (!ctx) return settingsRedirect(req, 'error', 'Your session expired. Please sign in and try again.');

  // state must match the logged-in manager (CSRF protection)
  if (state !== ctx.manager.id) {
    return settingsRedirect(req, 'error', 'Security check failed. Please try connecting again.');
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) throw new Error('No access token returned by Google');

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: userinfo } = await oauth2.userinfo.get();
    if (!userinfo.email) throw new Error('Could not read email address from Google');

    const admin = createAdminClient();
    await admin.from('email_integrations').upsert({
      manager_id: ctx.manager.id,
      organization_id: ctx.organization.id,
      provider: 'gmail',
      email_address: userinfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      smtp_host: null, smtp_port: null, smtp_secure: null,
      smtp_username: null, smtp_password_encrypted: null, smtp_password_iv: null, smtp_from_name: null,
      is_active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'manager_id' });

    return settingsRedirect(req, 'connected', `Gmail connected: ${userinfo.email}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gmail-callback]', msg);
    return settingsRedirect(req, 'error', `Failed to connect Gmail: ${msg}`);
  }
}
