/**
 * Gmail / Google Workspace integration.
 *
 * MANUAL SETUP (Google Cloud Console):
 *   1. Go to https://console.cloud.google.com
 *   2. Create a new project (or use an existing one)
 *   3. Enable the Gmail API (APIs & Services -> Library -> "Gmail API" -> Enable)
 *   4. Create OAuth 2.0 credentials of type "Web application"
 *   5. Add authorized redirect URIs:
 *        https://yourdomain.com/api/auth/gmail/callback   (production)
 *        http://localhost:3000/api/auth/gmail/callback     (development)
 *   6. Copy the Client ID and Client Secret into .env.local:
 *        GOOGLE_CLIENT_ID=
 *        GOOGLE_CLIENT_SECRET=
 *   7. On the OAuth consent screen, add the scopes gmail.send and
 *      userinfo.email, and add yourself as a test user.
 */
import 'server-only';
import { google } from 'googleapis';
import { createAdminClient } from './supabase-server';
import { buildMimeMessage, EmailAttachment } from './mime';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl()}/api/auth/gmail/callback`,
  );
}

/** Builds the consent-screen URL. `state` carries the manager id. */
export function getGmailAuthUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token issuance
    scope: GMAIL_SCOPES,
    state,
  });
}

/** Refreshes the access token if it expires within 5 minutes. Returns a valid access token. */
export async function refreshGmailTokenIfNeeded(managerId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('*')
    .eq('manager_id', managerId)
    .eq('provider', 'gmail')
    .maybeSingle();
  if (!integration) throw new Error('No Gmail account connected');

  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  const fiveMin = 5 * 60 * 1000;
  if (integration.access_token && expiresAt - Date.now() > fiveMin) {
    return integration.access_token;
  }

  const client = createOAuthClient();
  client.setCredentials({ refresh_token: integration.refresh_token });
  const { credentials } = await client.refreshAccessToken();

  await admin.from('email_integrations').update({
    access_token: credentials.access_token,
    token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
    // Google may rotate the refresh token
    refresh_token: credentials.refresh_token ?? integration.refresh_token,
  }).eq('id', integration.id);

  if (!credentials.access_token) throw new Error('Failed to refresh Gmail access token');
  return credentials.access_token;
}

/** Returns an authenticated Gmail API client for the manager. */
export async function getGmailClient(managerId: string) {
  const accessToken = await refreshGmailTokenIfNeeded(managerId);
  const client = createOAuthClient();
  client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: client });
}

export async function sendEmailViaGmail(params: {
  managerId: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<string> {
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('email_integrations')
    .select('email_address')
    .eq('manager_id', params.managerId)
    .eq('provider', 'gmail')
    .maybeSingle();
  if (!integration) throw new Error('No Gmail account connected');

  const gmail = await getGmailClient(params.managerId);
  const raw = buildMimeMessage({
    from: integration.email_address,
    to: params.to,
    subject: params.subject,
    html: params.body,
    replyTo: params.replyTo,
    attachments: params.attachments,
  });

  try {
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    if (!res.data.id) throw new Error('Gmail did not return a message id');
    return res.data.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Gmail error';
    throw new Error(`Failed to send via Gmail: ${msg}`);
  }
}
