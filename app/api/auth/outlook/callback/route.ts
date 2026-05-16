import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { getCurrentManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-server';
import { exchangeCodeForTokens } from '@/lib/outlook';

export const runtime = 'nodejs';

function settingsRedirect(req: NextRequest, status: 'connected' | 'error', message?: string) {
  const url = new URL('/dashboard/settings/email', req.url);
  url.searchParams.set('status', status);
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}

// GET /api/auth/outlook/callback — handle Microsoft's OAuth redirect.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');

  if (oauthError) return settingsRedirect(req, 'error', `Microsoft denied access: ${oauthError}`);
  if (!code) return settingsRedirect(req, 'error', 'Missing authorization code');

  const ctx = await getCurrentManager();
  if (!ctx) return settingsRedirect(req, 'error', 'Your session expired. Please sign in and try again.');
  if (state !== ctx.manager.id) {
    return settingsRedirect(req, 'error', 'Security check failed. Please try connecting again.');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Read the connected email address from Microsoft Graph /me
    const client = Client.init({ authProvider: (done) => done(null, tokens.access_token) });
    const me = await client.api('/me').select('mail,userPrincipalName').get();
    const email: string | undefined = me.mail || me.userPrincipalName;
    if (!email) throw new Error('Could not read email address from Microsoft');

    const admin = createAdminClient();
    await admin.from('email_integrations').upsert({
      manager_id: ctx.manager.id,
      organization_id: ctx.organization.id,
      provider: 'outlook',
      email_address: email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      smtp_host: null, smtp_port: null, smtp_secure: null,
      smtp_username: null, smtp_password_encrypted: null, smtp_password_iv: null, smtp_from_name: null,
      is_active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'manager_id' });

    return settingsRedirect(req, 'connected', `Outlook connected: ${email}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[outlook-callback]', msg);
    return settingsRedirect(req, 'error', `Failed to connect Outlook: ${msg}`);
  }
}
