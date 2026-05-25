import { requireManager } from '@/lib/auth';
import { MusiciansClient } from './client';

export const metadata = { title: 'Contacts — Callscade' };

export default async function MusiciansPage() {
  await requireManager();
  return <MusiciansClient />;
}
