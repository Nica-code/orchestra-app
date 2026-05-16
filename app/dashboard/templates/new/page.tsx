import { requireManager } from '@/lib/auth';
import { TemplateEditor } from '@/components/templates/TemplateEditor';

export default async function NewTemplatePage() {
  await requireManager();
  return <TemplateEditor />;
}
