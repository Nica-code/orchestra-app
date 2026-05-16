import { requireManager } from '@/lib/auth';
import { TemplatesClient } from './client';

export default async function TemplatesPage() {
  await requireManager();
  return <TemplatesClient />;
}
