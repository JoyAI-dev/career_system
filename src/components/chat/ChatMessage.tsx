'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ExternalLinkWarning } from './ExternalLinkWarning';
import type { ChatMessageData } from './ChatProvider';

interface ChatMessageProps {
  message: ChatMessageData;
  isOwnMessage: boolean;
  currentUserId: string;
}

// URL regex for detecting links
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

function MessageContent({ content, currentUserId, mentions }: {
  content: string;
  currentUserId: string;
  mentions: string[];
}) {
  const parts = useMemo(() => {
    const result: { type: 'text' | 'link' | 'mention'; value: string }[] = [];
    let lastIndex = 0;

    // Find all URLs
    const matches = [...content.matchAll(URL_REGEX)];

    for (const match of matches) {
      const index = match.index!;
      if (index > lastIndex) {
        result.push({ type: 'text', value: content.slice(lastIndex, index) });
      }
      result.push({ type: 'link', value: match[0] });
      lastIndex = index + match[0].length;
    }

    if (lastIndex < content.length) {
      result.push({ type: 'text', value: content.slice(lastIndex) });
    }

    // Process mentions in text parts
    return result.flatMap((part) => {
      if (part.type !== 'text') return [part];
      const mentionRegex = /@(\S+)/g;
      const subParts: typeof result = [];
      let subLastIndex = 0;
      const subMatches = [...part.value.matchAll(mentionRegex)];

      for (const m of subMatches) {
        const idx = m.index!;
        if (idx > subLastIndex) {
          subParts.push({ type: 'text', value: part.value.slice(subLastIndex, idx) });
        }
        subParts.push({ type: 'mention', value: m[0] });
        subLastIndex = idx + m[0].length;
      }
      if (subLastIndex < part.value.length) {
        subParts.push({ type: 'text', value: part.value.slice(subLastIndex) });
      }
      return subParts;
    });
  }, [content]);

  return (
    <span className="break-words whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.type === 'link') {
          if (isExternalUrl(part.value)) {
            return <ExternalLinkWarning key={i} url={part.value} />;
          }
          return (
            <a
              key={i}
              href={part.value}
              className="text-blue-500 underline hover:text-blue-700"
            >
              {part.value}
            </a>
          );
        }
        if (part.type === 'mention') {
          const isMentioningMe = mentions.includes(currentUserId);
          return (
            <span
              key={i}
              className={cn(
                'rounded px-0.5 font-medium',
                isMentioningMe ? 'bg-yellow-200 text-yellow-800' : 'text-blue-600',
              )}
            >
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
}

export function ChatMessageBubble({ message, isOwnMessage, currentUserId }: ChatMessageProps) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-1',
        isOwnMessage ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {!isOwnMessage && (
        <Avatar className="mt-1 h-7 w-7 shrink-0">
          <AvatarFallback className="text-[10px] bg-gray-200">
            {message.senderName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'flex max-w-[70%] flex-col',
          isOwnMessage ? 'items-end' : 'items-start',
        )}
      >
        {!isOwnMessage && (
          <span className="mb-0.5 text-[10px] text-gray-400">{message.senderName}</span>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isOwnMessage
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md',
          )}
        >
          <MessageContent
            content={message.content}
            currentUserId={currentUserId}
            mentions={message.mentions}
          />
        </div>
        <span className="mt-0.5 text-[10px] text-gray-300">{time}</span>
      </div>
    </div>
  );
}
