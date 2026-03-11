import { requireAdmin } from '@/lib/auth';
import { getTags } from '@/server/queries/tag';
import { TagManager } from './TagManager';

export default async function TagsPage() {
  await requireAdmin();

  const tags = await getTags();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Tags</h1>
      <TagManager tags={tags} />
    </div>
  );
}
