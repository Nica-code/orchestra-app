import { requireManager } from '@/lib/auth';
import { ConcertsClient } from './client';

export default async function ConcertsPage() {
  await requireManager();
  return <ConcertsClient />;
}
