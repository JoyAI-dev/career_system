'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Users, MessageSquare, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface RoomStats {
  roomId: string;
  type: string;
  memberCount: number;
  messageCount: number;
}

interface ChatStats {
  rooms: RoomStats[];
  onlineUsers: number;
  messageCounts: Record<string, number>;
}

export function ChatStatsClient() {
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/internal/chat-stats');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch {
      setError('无法获取聊天统计数据');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const totalMessages = stats
    ? Object.values(stats.messageCounts).reduce((sum, v) => sum + v, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.onlineUsers ?? '-'}</p>
            <p className="text-xs text-muted-foreground">在线用户</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.rooms.length ?? '-'}</p>
            <p className="text-xs text-muted-foreground">活跃聊天室</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalMessages}</p>
            <p className="text-xs text-muted-foreground">总消息数</p>
          </div>
        </Card>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {/* Room list */}
      {stats && stats.rooms.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>聊天室</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-center">在线成员</TableHead>
                <TableHead className="text-center">消息数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.rooms.map((room) => (
                <TableRow key={room.roomId}>
                  <TableCell className="font-medium">{room.roomId}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {room.type === 'community'
                        ? '社区'
                        : room.type === 'group'
                          ? '小组'
                          : '私聊'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{room.memberCount}</TableCell>
                  <TableCell className="text-center">{room.messageCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">暂无活跃聊天室</p>
          </div>
        )
      )}
    </div>
  );
}
