import { requireManager } from '@/lib/auth';
import { ConcertsClient } from './client';

export const metadata = { title: 'Concerts — FirstCall' };

export default async function ConcertsPage() {
  await requireManager();
  return <ConcertsClient />;
}
