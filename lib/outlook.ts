/**
 * Microsoft Outlook / Microsoft 365 integration.
 *
 * MANUAL SETUP (Azure Portal):
 *   1. Go to https://portal.azure.com
 *   2. Microsoft Entra ID -> App registrations -> New registration
 *   3. Name it "Callscade"
 *   4. Supported account types:
 *        "Accounts in any organizational directory and personal Microsoft accounts"
 *   5. Add a Web redirect URI:
 *        https://yourdomain.com/api/auth/outlook/callback   (production)
 *        http://localhost:3000/api/auth/outlook/callback     (development)
 *   6. Certificates & Secrets -> New client secret -> copy the VALUE
 *   7. API Permissions -> Microsoft Graph -> Delegated:
 *        Mail.Send, User.Read, offline_access
 *   8. Copy Application (client) ID + secret into .env.local:
 *        MICROSOFT_CLIENT_ID=
 *        MICROSOFT_CLIENT_SECRET=
 *
 * NOTE: We use the raw OAuth2 token endpoint (not @azure/msal-node) so the
 * refresh_token can be persisted to the database for background sends.
 */
import 'server-only';
import { Client } from '@microsoft/microsoft-graph-client';
import { createAdminClient } from './supabase-server';
import { EmailAttachment } from './mime';

const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
export const OUTLOOK_SCOPES = ['Mail.Send', 'User.Read', 'offline_access', 'openid', 'email', 'profile'];

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
function redirectUri() {
  return `${appUrl()}/api/auth/outlook/callback`;
}

export function getOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: OUTLOOK_SCOPES.join(' '),
    state,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirect_uri: redirectUri(),
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token request failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Exchange an authorization code for tokens (used by the OAuth callback). */
export function exchangeCodeForTokens(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, scope: OUTLOOK_SCOPES.join(' ') });
}

/** Refresh the access token if it expires within 5 minutes. Returns a valid access token. */
export async function refreshOutlookTokenIfNeeded(managerId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('*')
    .eq('manager_id', managerId)
    .eq('provider', 'outlook')
    .maybeSingle();
  if (!integration) throw new Error('No Outlook account connected');

  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  const fiveMin = 5 * 60 * 1000;
  if (integration.access_token && expiresAt - Date.now() > fiveMin) {
    return integration.access_token;
  }
  if (!integration.refresh_token) throw new Error('Outlook connection has no refresh token — please reconnect');

  const tokens = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
    scope: OUTLOOK_SCOPES.join(' '),
  });

  await admin.from('email_integrations').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? integration.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('id', integration.id);

  return tokens.access_token;
}

/** Returns an authenticated Microsoft Graph client for the manager. */
export async function getOutlookClient(managerId: string): Promise<Client> {
  const accessToken = await refreshOutlookTokenIfNeeded(managerId);
  return Client.init({ authProvider: (done) => done(null, accessToken) });
}

export async function sendEmailViaOutlook(params: {
  managerId: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<string> {
  try {
    const client = await getOutlookClient(params.managerId);
    const message: Record<string, unknown> = {
      subject: params.subject,
      body: { contentType: 'HTML', content: params.body },
      toRecipients: [{ emailAddress: { address: params.to } }],
    };
    if (params.replyTo) {
      message.replyTo = [{ emailAddress: { address: params.replyTo } }];
    }
    if (params.attachments && params.attachments.length > 0) {
      message.attachments = params.attachments.map((a) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.filename,
        contentType: a.mimeType,
        contentBytes: a.content.toString('base64'),
      }));
    }
    await client.api('/me/sendMail').post({ message, saveToSentItems: true });
    // Graph sendMail returns 202 with no body / id
    return `outlook-${Date.now()}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Outlook error';
    throw new Error(`Failed to send via Outlook: ${msg}`);
  }
}
