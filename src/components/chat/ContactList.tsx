'use client';

import { useTranslations } from 'next-intl';
import { Users, User, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChat } from './ChatProvider';

export function ContactList() {
  const t = useTranslations('chat');
  const { rooms, friends, activeRoom, setActiveRoom, onlineUsers, openChat } = useChat();

  // Separate group chats and private chats
  const groupRooms = Array.from(rooms.values()).filter(
    (r) => r.type === 'community' || r.type === 'group',
  );
  const privateRooms = Array.from(rooms.values()).filter((r) => r.type === 'private');

  return (
    <div className="flex h-full flex-col border-r bg-gray-50/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <MessageCircle className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800">{t('title')}</h3>
      </div>

      <ScrollArea className="flex-1">
        {/* Group chats */}
        <div className="px-2 pt-2">
          <p className="mb-1 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            {t('groups')}
          </p>
          {groupRooms.length === 0 && (
            <p className="px-2 py-3 text-xs text-gray-400">{t('noGroups')}</p>
          )}
          {groupRooms.map((room) => (
            <button
              key={room.roomId}
              onClick={() => {
                setActiveRoom(room.roomId);
                openChat(room.roomId);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                activeRoom === room.roomId
                  ? 'bg-blue-100 text-blue-800'
                  : 'hover:bg-gray-100 text-gray-700',
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{room.name}</p>
                <p className="text-xs text-gray-400">{room.members.length} {t('members')}</p>
              </div>
              {room.unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                  {room.unreadCount}
                </Badge>
              )}
            </button>
          ))}
        </div>

        <Separator className="mx-2 my-2" />

        {/* Friends / Private chats */}
        <div className="px-2 pb-2">
          <p className="mb-1 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            {t('friends')}
          </p>
          {friends.length === 0 && privateRooms.length === 0 && (
            <p className="px-2 py-3 text-xs text-gray-400">{t('noFriends')}</p>
          )}
          {friends.map((friend) => {
            const privateRoomId = `private:${[friend.userId].sort().join(':')}`;
            const room = rooms.get(privateRoomId);
            const isOnline = onlineUsers.has(friend.userId);

            return (
              <button
                key={friend.userId}
                onClick={() => {
                  setActiveRoom(privateRoomId);
                  openChat(privateRoomId);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                  activeRoom === privateRoomId
                    ? 'bg-blue-100 text-blue-800'
                    : 'hover:bg-gray-100 text-gray-700',
                )}
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-gray-200">
                      {(friend.name || friend.username).slice(0, 2).toUpperCase()}
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
                  <p className="truncate text-sm font-medium">
                    {friend.name || friend.username}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isOnline ? t('online') : t('offline')}
                  </p>
                </div>
                {room && room.unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                    {room.unreadCount}
                  </Badge>
                )}
              </button>
            );
          })}
          {/* Show private rooms for non-friend users (unlikely but safe) */}
          {privateRooms
            .filter((r) => !friends.some((f) => r.roomId.includes(f.userId)))
            .map((room) => (
              <button
                key={room.roomId}
                onClick={() => {
                  setActiveRoom(room.roomId);
                  openChat(room.roomId);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                  activeRoom === room.roomId
                    ? 'bg-blue-100 text-blue-800'
                    : 'hover:bg-gray-100 text-gray-700',
                )}
              >
                <User className="h-4 w-4 text-gray-400" />
                <span className="truncate text-sm">{room.name}</span>
                {room.unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                    {room.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
