import { requireManager } from '@/lib/auth';
import { MusiciansClient } from './client';

export const metadata = { title: 'Musicians — FirstCall' };

export default async function MusiciansPage() {
  await requireManager();
  return <MusiciansClient />;
}
