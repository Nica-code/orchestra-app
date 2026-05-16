import { requireManager } from '@/lib/auth';
import { MusiciansClient } from './client';

export default async function MusiciansPage() {
  await requireManager();
  return <MusiciansClient />;
}
