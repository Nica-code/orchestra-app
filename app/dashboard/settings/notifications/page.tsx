import { requireManager } from '@/lib/auth';
import { getOrCreatePreferences } from '@/lib/notifications';
import { NotificationPreferencesForm } from './form';

export default async function NotificationSettingsPage() {
  const { manager } = await requireManager();
  const preferences = await getOrCreatePreferences(manager.id);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Notification Preferences</h1>
      <p className="mt-1 text-sm text-slate-600">
        Choose which notifications you receive by email and in-app.
      </p>
      <NotificationPreferencesForm preferences={preferences} />
    </div>
  );
}
