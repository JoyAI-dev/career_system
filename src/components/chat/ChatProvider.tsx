'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────

export interface ChatMessageData {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  mentions: string[];
  timestamp: number;
}

export interface RoomMember {
  userId: string;
  username: string;
  online: boolean;
}

export interface ChatRoom {
  roomId: string;
  type: 'community' | 'group' | 'private';
  name: string;
  members: RoomMember[];
  unreadCount: number;
}

export interface FriendInfo {
  friendshipId: string;
  userId: string;
  username: string;
  name: string | null;
}

interface ChatContextType {
  isConnected: boolean;
  isPopupOpen: boolean;
  activeRoom: string | null;
  rooms: Map<string, ChatRoom>;
  messages: Map<string, ChatMessageData[]>;
  onlineUsers: Set<string>;
  friends: FriendInfo[];
  unreadTotal: number;
  networkDrawerOpen: boolean;
  openChat: (roomId?: string) => void;
  closeChat: () => void;
  setActiveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, mentions?: string[]) => void;
  joinRoom: (roomId: string, name?: string) => void;
  sendTyping: (roomId: string) => void;
  setNetworkDrawerOpen: (open: boolean) => void;
  setFriends: (friends: FriendInfo[]) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────

interface ChatProviderProps {
  children: ReactNode;
  userId: string;
  username: string;
  initialFriends: FriendInfo[];
}

export function ChatProvider({
  children,
  userId,
  username,
  initialFriends,
}: ChatProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [activeRoom, setActiveRoomState] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Map<string, ChatRoom>>(new Map());
  const [messages, setMessages] = useState<Map<string, ChatMessageData[]>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<FriendInfo[]>(initialFriends);
  const [networkDrawerOpen, setNetworkDrawerOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Calculate total unread
  const unreadTotal = Array.from(rooms.values()).reduce((sum, r) => sum + r.unreadCount, 0);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Fetch a short-lived WS auth token
    let token: string;
    try {
      const res = await fetch('/api/chat/token');
      if (!res.ok) return;
      const data = await res.json();
      token = data.token;
    } catch {
      // Retry later
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate with the fetched token
      ws.send(JSON.stringify({ type: 'auth', token }));
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Reconnect with exponential backoff
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const handleServerMessage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      switch (data.type) {
        case 'authenticated':
          setIsConnected(true);
          break;

        case 'message': {
          const msg = data.message as ChatMessageData;
          setMessages((prev) => {
            const next = new Map(prev);
            const roomMsgs = [...(next.get(msg.roomId) || []), msg];
            next.set(msg.roomId, roomMsgs);
            return next;
          });
          // Increment unread if not active room
          setRooms((prev) => {
            const room = prev.get(msg.roomId);
            if (room && msg.senderId !== userId) {
              const next = new Map(prev);
              next.set(msg.roomId, {
                ...room,
                unreadCount: room.unreadCount + (activeRoom === msg.roomId ? 0 : 1),
              });
              return next;
            }
            return prev;
          });
          break;
        }

        case 'room_members': {
          const { roomId, members } = data as {
            roomId: string;
            members: RoomMember[];
          };
          setRooms((prev) => {
            const room = prev.get(roomId);
            if (room) {
              const next = new Map(prev);
              next.set(roomId, { ...room, members });
              return next;
            }
            return prev;
          });
          break;
        }

        case 'user_online':
          setOnlineUsers((prev) => new Set([...prev, data.userId]));
          break;

        case 'user_offline':
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
          break;

        case 'room_joined':
          // Room join confirmed
          break;

        case 'error':
          console.warn('[Chat]', data.message);
          break;
      }
    },
    [userId, activeRoom],
  );

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const openChat = useCallback((roomId?: string) => {
    setIsPopupOpen(true);
    if (roomId) {
      setActiveRoomState(roomId);
      // Clear unread
      setRooms((prev) => {
        const room = prev.get(roomId);
        if (room) {
          const next = new Map(prev);
          next.set(roomId, { ...room, unreadCount: 0 });
          return next;
        }
        return prev;
      });
    }
  }, []);

  const closeChat = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  const setActiveRoom = useCallback((roomId: string) => {
    setActiveRoomState(roomId);
    // Clear unread for this room
    setRooms((prev) => {
      const room = prev.get(roomId);
      if (room) {
        const next = new Map(prev);
        next.set(roomId, { ...room, unreadCount: 0 });
        return next;
      }
      return prev;
    });
  }, []);

  const sendMessage = useCallback(
    (roomId: string, content: string, mentions?: string[]) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'message', roomId, content, mentions: mentions || [] }),
        );
      }
    },
    [],
  );

  const joinRoom = useCallback(
    (roomId: string, name?: string) => {
      // Add room to local state
      setRooms((prev) => {
        if (prev.has(roomId)) return prev;
        const next = new Map(prev);
        const type = roomId.startsWith('community:')
          ? 'community'
          : roomId.startsWith('group:')
            ? 'group'
            : 'private';
        next.set(roomId, {
          roomId,
          type: type as ChatRoom['type'],
          name: name || roomId,
          members: [],
          unreadCount: 0,
        });
        return next;
      });

      // Tell server
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'join_room', roomId }));
      }
    },
    [],
  );

  const sendTyping = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', roomId }));
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isConnected,
        isPopupOpen,
        activeRoom,
        rooms,
        messages,
        onlineUsers,
        friends,
        unreadTotal,
        networkDrawerOpen,
        openChat,
        closeChat,
        setActiveRoom,
        sendMessage,
        joinRoom,
        sendTyping,
        setNetworkDrawerOpen,
        setFriends,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
