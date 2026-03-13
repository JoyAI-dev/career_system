import { requireAdminPage } from '@/lib/auth';
import { ChatStatsClient } from './ChatStatsClient';

export default async function ChatStatsPage() {
  await requireAdminPage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">聊天统计</h1>
        <p className="text-sm text-muted-foreground">
          查看群组聊天的实时消息统计。数据仅在服务器运行期间有效。
        </p>
      </div>
      <ChatStatsClient />
    </div>
  );
}
