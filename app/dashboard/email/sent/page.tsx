import { redirect } from 'next/navigation';
import { requireManager } from '@/lib/auth';

// Redirect to the existing history page which has the full send log UI
export default async function SentPage() {
  await requireManager();
  redirect('/dashboard/concerts/history');
}
