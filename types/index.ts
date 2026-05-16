// Database types for orchestra-app.
// Keep these in sync with supabase/migrations/*.sql

export type UUID = string;
export type Timestamp = string; // ISO 8601

// ---------- enums ----------
export type ManagerRole = 'admin' | 'manager';
export type ManagerStatus = 'active' | 'pending';
export type PlanType = 'starter' | 'pro';
export type PlanStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';
export type SendStatus = 'queued' | 'sent' | 'accepted' | 'declined' | 'no_response' | 'skipped' | 'failed';
export type EmailProvider = 'gmail' | 'microsoft' | 'smtp';
export type NotificationType =
  | 'response_accepted'
  | 'response_declined'
  | 'no_response_advanced'
  | 'position_filled'
  | 'send_failed'
  | 'trial_ending'
  | 'payment_failed';

// ---------- tables ----------
export interface Organization {
  id: UUID;
  name: string;
  logo_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ManagerInvite {
  id: UUID;
  organization_id: UUID;
  email: string;
  role: ManagerRole;
  token: string;
  expires_at: Timestamp;
  accepted_at: Timestamp | null;
  invited_by: UUID | null;
  created_at: Timestamp;
}

export interface Manager {
  id: UUID;
  organization_id: UUID;
  user_id: UUID | null;
  email: string;
  role: ManagerRole;
  status: ManagerStatus;
  created_at: Timestamp;
}

export interface Plan {
  id: UUID;
  organization_id: UUID;
  plan_type: PlanType;
  send_count: number;
  send_limit: number;
  billing_period_start: Timestamp;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: Timestamp | null;
  status: PlanStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Musician {
  id: UUID;
  organization_id: UUID;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position: string;
  rank: number;
  notes: string | null;
  is_blacklisted: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MusicianAvailability {
  id: UUID;
  musician_id: UUID;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason: string | null;
  created_at: Timestamp;
}

// Musician with computed/joined flags used in list views
export interface MusicianWithStatus extends Musician {
  currently_unavailable?: boolean;
  has_notes?: boolean;
}

export interface EmailIntegration {
  id: UUID;
  manager_id: UUID;
  organization_id: UUID;
  provider: EmailProvider;
  email_address: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Timestamp | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  smtp_password_iv: string | null;
  smtp_from_name: string | null;
  is_active: boolean;
  connected_at: Timestamp;
  updated_at: Timestamp;
}

export interface EmailTemplate {
  id: UUID;
  organization_id: UUID;
  name: string;
  subject: string;
  body: string; // supports {{name}}, {{concert_name}}, {{date}}, etc.
  is_default: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TemplateAttachment {
  id: UUID;
  template_id: UUID;
  file_name: string;
  file_path: string; // path in Supabase Storage
  file_size: number;
  mime_type: string | null;
  created_at: Timestamp;
}

export interface Concert {
  id: UUID;
  organization_id: UUID;
  created_by: UUID; // manager id
  name: string;
  concert_date: Timestamp;
  rehearsal_dates: Timestamp[] | null;
  venue: string | null;
  notes: string | null;
  status: 'draft' | 'sending' | 'completed' | 'cancelled';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ConcertPosition {
  id: UUID;
  concert_id: UUID;
  position_name: string; // e.g. "Principal Violin"
  instrument: string;
  template_id: UUID | null;
  no_response_days: number | null; // null = off
  status: 'pending' | 'sending' | 'filled' | 'exhausted' | 'cancelled';
  filled_by_musician_id: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ConcertPositionMusician {
  id: UUID;
  concert_position_id: UUID;
  musician_id: UUID;
  rank: number;
  status: SendStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SendLog {
  id: UUID;
  concert_position_id: UUID;
  musician_id: UUID;
  manager_id: UUID;
  template_id: UUID | null;
  subject: string;
  body: string;
  status: SendStatus;
  unique_token: string; // for accept/decline links
  sent_at: Timestamp | null;
  responded_at: Timestamp | null;
  error_message: string | null;
  created_at: Timestamp;
}

export interface Notification {
  id: UUID;
  organization_id: UUID;
  manager_id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: Timestamp;
}

export interface ActivityLog {
  id: UUID;
  organization_id: UUID;
  manager_id: UUID | null;
  action: string;
  entity_type: string | null;
  entity_id: UUID | null;
  metadata: Record<string, unknown> | null;
  created_at: Timestamp;
}

export interface Usage {
  id: UUID;
  organization_id: UUID;
  period_start: Timestamp;
  period_end: Timestamp;
  sends_used: number;
  created_at: Timestamp;
}
