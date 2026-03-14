'use client';

import { useTranslations } from 'next-intl';
import { Users, UserPlus, UserCheck, MessageCircle, Clock, Ban } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useChat } from './ChatProvider';
import { sendFriendRequest } from '@/server/actions/friendship';

interface GroupData {
  id: string;
  name: string;
  type: 'community' | 'virtualGroup';
  memberCount: number;
  members: {
    userId: string;
    username: string;
    name: string | null;
  }[];
}

interface StudentNetworkDrawerProps {
  groups: GroupData[];
  userId: string;
}

export function StudentNetworkDrawer({ groups, userId }: StudentNetworkDrawerProps) {
  const t = useTranslations('chat');
  const { networkDrawerOpen, setNetworkDrawerOpen, openChat, joinRoom, friends, onlineUsers } =
    useChat();

  const handleOpenGroupChat = (group: GroupData) => {
    const roomId =
      group.type === 'community' ? `community:${group.id}` : `group:${group.id}`;
    joinRoom(roomId, group.name);
    openChat(roomId);
    setNetworkDrawerOpen(false);
  };

  return (
    <Drawer open={networkDrawerOpen} onOpenChange={setNetworkDrawerOpen} handleOnly>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-3">
          <DrawerTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            {t('studentNetwork')}
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-4">
          {groups.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Users className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">{t('noGroups')}</p>
            </div>
          )}

          <div className="space-y-4">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                userId={userId}
                friends={friends}
                onlineUsers={onlineUsers}
                onOpenChat={() => handleOpenGroupChat(group)}
                t={t}
              />
            ))}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

function GroupCard({
  group,
  userId,
  friends,
  onlineUsers,
  onOpenChat,
  t,
}: {
  group: GroupData;
  userId: string;
  friends: { userId: string }[];
  onlineUsers: Set<string>;
  onOpenChat: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Group header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            group.type === 'community' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600',
          )}
        >
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{group.name}</h3>
          <p className="text-xs text-gray-400">
            {group.memberCount} {t('members')}
            {group.type === 'community' ? ' · ' + t('communityLabel') : ' · ' + t('groupLabel')}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat();
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {t('openChat')}
        </Button>
      </div>

      {/* Expanded member list */}
      {expanded && (
        <>
          <Separator />
          <div className="p-3 space-y-1">
            {group.members.map((member) => {
              const isSelf = member.userId === userId;
              const isFriend = friends.some((f) => f.userId === member.userId);
              const isOnline = onlineUsers.has(member.userId);

              return (
                <MemberRow
                  key={member.userId}
                  member={member}
                  isSelf={isSelf}
                  isFriend={isFriend}
                  isOnline={isOnline}
                  t={t}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  isFriend,
  isOnline,
  t,
}: {
  member: { userId: string; username: string; name: string | null };
  isSelf: boolean;
  isFriend: boolean;
  isOnline: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'blocked'>('idle');
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      setStatus('sending');
      const result = await sendFriendRequest(member.userId);
      if (result.success) {
        setStatus('sent');
      } else if (result.error?.includes('限制') || result.error?.includes('无法')) {
        setStatus('blocked');
      } else {
        setStatus('sent'); // Already sent, treat as sent
      }
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50">
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-gray-100">
            {(member.name || member.username).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
            isOnline ? 'bg-green-400' : 'bg-gray-300',
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700 truncate">
          {member.name || member.username}
        </p>
        <p className="text-[11px] text-gray-400">@{member.username}</p>
      </div>
      {isSelf ? (
        <Badge variant="secondary" className="text-[10px]">{t('you')}</Badge>
      ) : isFriend ? (
        <Badge variant="secondary" className="text-[10px] gap-1 text-green-600 bg-green-50">
          <UserCheck className="h-3 w-3" />
          {t('friendLabel')}
        </Badge>
      ) : status === 'idle' ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={handleAdd}
          disabled={isPending}
        >
          <UserPlus className="h-3 w-3" />
          {t('addFriend')}
        </Button>
      ) : status === 'sending' ? (
        <Clock className="h-4 w-4 text-gray-400 animate-pulse" />
      ) : status === 'sent' ? (
        <Badge variant="secondary" className="text-[10px]">{t('requestSent')}</Badge>
      ) : (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <Ban className="h-3 w-3" />
          {t('blocked')}
        </Badge>
      )}
    </div>
  );
}
