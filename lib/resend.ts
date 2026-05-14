// Lightweight Resend client (REST over fetch). Avoids extra dependency.
const RESEND_API = 'https://api.resend.com/emails';

export async function sendEmail(params: {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY missing; skipping send');
    return { id: null, skipped: true };
  }
  const body = {
    from: params.from ?? 'Orchestra App <onboarding@resend.dev>',
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    reply_to: params.reply_to,
  };
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ id: string }>;
}
