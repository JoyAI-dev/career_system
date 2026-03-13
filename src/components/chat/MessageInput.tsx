'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useChat, type RoomMember } from './ChatProvider';

interface MessageInputProps {
  roomId: string;
  members: RoomMember[];
  userId: string;
}

export function MessageInput({ roomId, members, userId }: MessageInputProps) {
  const t = useTranslations('chat');
  const { sendMessage, sendTyping } = useChat();
  const [value, setValue] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter members for @mention (exclude self)
  const filteredMembers = members
    .filter((m) => m.userId !== userId)
    .filter((m) =>
      mentionQuery
        ? m.username.toLowerCase().includes(mentionQuery.toLowerCase())
        : true,
    );

  const handleSelectMention = useCallback(
    (member: RoomMember) => {
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(mentionStartIndex + 1 + mentionQuery.length);
      const newVal = `${before}@${member.username} ${after}`;
      setValue(newVal);
      setMentionOpen(false);
      setSelectedMentions((prev) => [...prev, member.userId]);
      setTimeout(() => {
        textareaRef.current?.focus();
        const pos = mentionStartIndex + member.username.length + 2;
        textareaRef.current?.setSelectionRange(pos, pos);
      }, 0);
    },
    [value, mentionStartIndex, mentionQuery],
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    sendMessage(roomId, trimmed, selectedMentions);
    setValue('');
    setSelectedMentions([]);
    textareaRef.current?.focus();
  }, [value, roomId, selectedMentions, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && filteredMembers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % filteredMembers.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev === 0 ? filteredMembers.length - 1 : prev - 1,
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          handleSelectMention(filteredMembers[highlightedIndex]);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (mentionOpen) return;
        handleSend();
      }
      if (e.key === 'Escape' && mentionOpen) {
        setMentionOpen(false);
      }
    },
    [mentionOpen, filteredMembers, highlightedIndex, handleSelectMention, handleSend],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = newVal.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 20) {
        setMentionOpen(true);
        setMentionQuery(textAfterAt);
        setMentionStartIndex(atIndex);
        setHighlightedIndex(0);
      } else {
        setMentionOpen(false);
      }
    } else {
      setMentionOpen(false);
    }

    // Send typing indicator (throttled)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(roomId);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div className="border-t bg-white p-3">
      <div className="relative">
        {/* @mention dropdown */}
        {mentionOpen && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border bg-white shadow-lg">
            <div className="max-h-40 overflow-y-auto p-1">
              {filteredMembers.map((member, index) => (
                <button
                  key={member.userId}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    index === highlightedIndex
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700',
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea blur
                    handleSelectMention(member);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      member.online ? 'bg-green-400' : 'bg-gray-300',
                    )}
                  />
                  <span>{member.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay closing to allow click on mention item
            setTimeout(() => setMentionOpen(false), 200);
          }}
          placeholder={t('typeMessage')}
          className="min-h-[60px] max-h-[120px] resize-none pr-12 text-sm"
          rows={2}
        />

        <Button
          size="sm"
          onClick={handleSend}
          disabled={!value.trim()}
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full p-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
