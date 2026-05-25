// App-wide constants.
export const APP_NAME = 'Callscade';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export const PLAN_LIMITS = {
  starter: { sends: 500, managers: 1 },
  pro: { sends: 3000, managers: 3 },
} as const;

export const OVERAGE_RATE_CENTS = 1000;       // $10 per 1,000 sends
export const OVERAGE_BLOCK_SIZE = 1000;
export const TRIAL_DAYS = 30;
export const TOKEN_EXPIRY_DEFAULT_DAYS = 2;
export const MAX_TEMPLATE_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_SIZE_MB = 10;
export const SEND_LIMIT_WARNING_THRESHOLD = 0.8;
