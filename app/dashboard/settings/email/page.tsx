import { requireManager } from '@/lib/auth';
import { checkEmailConnection } from '@/lib/emailHealth';
import { EmailSettingsClient } from './client';

export default async function EmailSettingsPage() {
  const { manager } = await requireManager();
  const health = await checkEmailConnection(manager.id);
  return <EmailSettingsClient initialHealth={health} />;
}
