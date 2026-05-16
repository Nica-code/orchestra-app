import { requireManager } from '@/lib/auth';
import { ImportWizard } from './wizard';

export default async function ImportMusiciansPage() {
  await requireManager();
  return <ImportWizard />;
}
