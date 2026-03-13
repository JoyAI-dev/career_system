'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, UserCheck, Clock, Ban } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChat } from './ChatProvider';
import { sendFriendRequest } from '@/server/actions/friendship';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

interface ChatSidePanelProps {
  userId: string;
}

export function ChatSidePanel({ userId }: ChatSidePanelProps) {
  const t = useTranslations('chat');
  const { activeRoom, rooms, onlineUsers, friends } = useChat();

  const room = activeRoom ? rooms.get(activeRoom) : null;

  if (!room) {
    return <div className="border-l bg-gray-50/50" />;
  }

  const isGroupChat = room.type === 'community' || room.type === 'group';

  if (!isGroupChat) {
    // Private chat - show user profile
    return (
      <div className="flex flex-col items-center border-l bg-gray-50/50 p-4">
        <p className="text-xs text-gray-400">{t('privateChat')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l bg-gray-50/50">
      <div className="border-b px-3 py-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t('members')} ({room.members.length})
        </h4>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {room.members.map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              isOnline={onlineUsers.has(member.userId)}
              isSelf={member.userId === userId}
              isFriend={friends.some((f) => f.userId === member.userId)}
              t={t}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function MemberItem({
  member,
  isOnline,
  isSelf,
  isFriend,
  t,
}: {
  member: { userId: string; username: string; online: boolean };
  isOnline: boolean;
  isSelf: boolean;
  isFriend: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [isPending, startTransition] = useTransition();

  const handleAddFriend = () => {
    startTransition(async () => {
      setStatus('sending');
      const result = await sendFriendRequest(member.userId);
      if (result.success) {
        setStatus('sent');
      } else {
        setStatus('error');
      }
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100">
      <div className="relative">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px] bg-gray-200">
            {member.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white',
            isOnline ? 'bg-green-400' : 'bg-gray-300',
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">
          {member.username}
          {isSelf && (
            <span className="ml-1 text-[10px] text-gray-400">({t('you')})</span>
          )}
        </p>
      </div>
      {!isSelf && !isFriend && (
        <div>
          {status === 'idle' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleAddFriend}
              disabled={isPending}
            >
              <UserPlus className="h-3.5 w-3.5 text-blue-500" />
            </Button>
          )}
          {status === 'sending' && (
            <Clock className="h-3.5 w-3.5 text-gray-400 animate-pulse" />
          )}
          {status === 'sent' && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1">
              {t('friendRequestSent')}
            </Badge>
          )}
          {status === 'error' && (
            <Ban className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>
      )}
      {!isSelf && isFriend && (
        <UserCheck className="h-3.5 w-3.5 text-green-500" />
      )}
    </div>
  );
}
