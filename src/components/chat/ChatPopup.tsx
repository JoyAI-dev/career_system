'use client';

import { useTranslations } from 'next-intl';
import { X, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useChat } from './ChatProvider';
import { ContactList } from './ContactList';
import { MessageArea } from './MessageArea';
import { ChatSidePanel } from './ChatSidePanel';

interface ChatPopupProps {
  userId: string;
}

export function ChatPopup({ userId }: ChatPopupProps) {
  const t = useTranslations('chat');
  const { isPopupOpen, closeChat, isConnected } = useChat();

  if (!isPopupOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-4 bottom-4 top-16 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200/50',
        'md:inset-auto md:bottom-6 md:right-6 md:top-auto md:h-[600px] md:w-[800px]',
        'lg:h-[650px] lg:w-[900px]',
        'animate-in fade-in slide-in-from-bottom-4 duration-200',
      )}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{t('title')}</h2>
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-300' : 'bg-gray-300',
            )}
          />
          <span className="text-[10px] text-blue-200">
            {isConnected ? t('connected') : t('connecting')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
            onClick={closeChat}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
            onClick={closeChat}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Contact list (1/5) */}
        <div className="w-1/5 min-w-[160px]">
          <ContactList />
        </div>

        {/* Center: Messages (3/5) */}
        <div className="flex-1">
          <MessageArea userId={userId} />
        </div>

        {/* Right: Side panel (1/5) */}
        <div className="hidden w-1/5 min-w-[140px] md:block">
          <ChatSidePanel userId={userId} />
        </div>
      </div>
    </div>
  );
}
