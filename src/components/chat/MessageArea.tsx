'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from './ChatProvider';
import { ChatMessageBubble } from './ChatMessage';
import { MessageInput } from './MessageInput';

interface MessageAreaProps {
  userId: string;
}

export function MessageArea({ userId }: MessageAreaProps) {
  const t = useTranslations('chat');
  const { activeRoom, messages, rooms } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const roomMessages = activeRoom ? messages.get(activeRoom) || [] : [];
  const room = activeRoom ? rooms.get(activeRoom) : null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [roomMessages.length]);

  if (!activeRoom || !room) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50/30 text-gray-400">
        <MessageSquare className="mb-3 h-12 w-12 opacity-30" />
        <p className="text-sm">{t('selectChat')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Room header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5 bg-white/50">
        <h4 className="text-sm font-semibold text-gray-800 truncate">{room.name}</h4>
        <span className="text-xs text-gray-400">
          ({room.members.length} {t('members')})
        </span>
      </div>

      {/* Memory warning */}
      <div className="flex items-start gap-2 border-b bg-amber-50 px-3 py-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-relaxed text-amber-700">
          {t('memoryWarning')}
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-gray-50/30">
        <div ref={scrollRef} className="space-y-1 py-3">
          {roomMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <MessageSquare className="mb-2 h-8 w-8" />
              <p className="text-xs">{t('noMessages')}</p>
            </div>
          )}
          {roomMessages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              isOwnMessage={msg.senderId === userId}
              currentUserId={userId}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <MessageInput
        roomId={activeRoom}
        members={room.members}
        userId={userId}
      />
    </div>
  );
}
