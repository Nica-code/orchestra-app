import { requireManager } from '@/lib/auth';
import { ConcertForm } from '@/components/concerts/ConcertForm';

export default async function NewConcertPage() {
  await requireManager();
  return <ConcertForm />;
}
