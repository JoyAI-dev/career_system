'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useChat } from './ChatProvider';

export function FloatingChatButton() {
  const { openChat, closeChat, isPopupOpen, isConnected, unreadTotal } = useChat();

  return (
    <button
      onClick={() => (isPopupOpen ? closeChat() : openChat())}
      title={isPopupOpen ? '关闭聊天' : '打开聊天'}
      className={cn(
        'fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200',
        'hover:scale-105 hover:shadow-xl active:scale-95',
        isPopupOpen
          ? 'bg-gray-600 text-white'
          : 'bg-blue-600 text-white hover:bg-blue-700',
      )}
      style={{ bottom: 96, right: 24 }}
    >
      <div className="relative">
        <MessageCircle className="h-6 w-6" />
        {unreadTotal > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-2.5 -right-3 h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
          >
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </Badge>
        )}
      </div>
      {/* Connection indicator */}
      <span
        className={cn(
          'absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white',
          isConnected ? 'bg-green-400' : 'bg-gray-400',
        )}
      />
    </button>
  );
}
