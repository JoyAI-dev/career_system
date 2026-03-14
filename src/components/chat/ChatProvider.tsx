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

export interface ActivityCommentData {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; username: string };
}

export type ActivityCommentListener = (comment: ActivityCommentData) => void;

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

export interface GroupInfo {
  id: string;
  name: string;
  type: 'community' | 'virtualGroup';
  memberCount: number;
  members: { userId: string; username: string; name: string | null }[];
}

interface ChatContextType {
  userId: string;
  isConnected: boolean;
  isPopupOpen: boolean;
  activeRoom: string | null;
  rooms: Map<string, ChatRoom>;
  messages: Map<string, ChatMessageData[]>;
  onlineUsers: Set<string>;
  friends: FriendInfo[];
  groups: GroupInfo[];
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
  // Activity comment real-time support
  joinActivity: (activityId: string) => void;
  leaveActivity: (activityId: string) => void;
  subscribeActivityComment: (activityId: string, listener: ActivityCommentListener) => void;
  unsubscribeActivityComment: (activityId: string, listener: ActivityCommentListener) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function groupToRoomId(group: GroupInfo): string {
  return group.type === 'community' ? `community:${group.id}` : `group:${group.id}`;
}

function groupToChatRoomType(group: GroupInfo): ChatRoom['type'] {
  return group.type === 'community' ? 'community' : 'group';
}

// Build initial rooms Map from groups
function buildInitialRooms(groups: GroupInfo[]): Map<string, ChatRoom> {
  const map = new Map<string, ChatRoom>();
  for (const g of groups) {
    const roomId = groupToRoomId(g);
    map.set(roomId, {
      roomId,
      type: groupToChatRoomType(g),
      name: g.name,
      members: g.members.map((m) => ({
        userId: m.userId,
        username: m.username,
        online: false,
      })),
      unreadCount: 0,
    });
  }
  return map;
}

// ─── Provider ─────────────────────────────────────────────────────────

interface ChatProviderProps {
  children: ReactNode;
  userId: string;
  username: string;
  initialFriends: FriendInfo[];
  initialGroups: GroupInfo[];
}

export function ChatProvider({
  children,
  userId,
  username,
  initialFriends,
  initialGroups,
}: ChatProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [activeRoom, setActiveRoomState] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Map<string, ChatRoom>>(() => buildInitialRooms(initialGroups));
  const [messages, setMessages] = useState<Map<string, ChatMessageData[]>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<FriendInfo[]>(initialFriends);
  const [groups] = useState<GroupInfo[]>(initialGroups);
  const [networkDrawerOpen, setNetworkDrawerOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const initialGroupsRef = useRef(initialGroups);

  // ─── Activity comment listeners ──────────────────────────────────
  const activityCommentListenersRef = useRef<Map<string, Set<ActivityCommentListener>>>(new Map());

  // ─── Refs for avoiding stale closures in WebSocket handlers ──────
  // The WebSocket onmessage handler is set once during connect() and captures
  // a closure. Using refs ensures it always accesses the latest values.
  const activeRoomRef = useRef<string | null>(null);

  // Keep activeRoomRef in sync with activeRoom state
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Calculate total unread
  const unreadTotal = Array.from(rooms.values()).reduce((sum, r) => sum + r.unreadCount, 0);

  // Auto-join all group rooms after WebSocket authentication
  const autoJoinGroupRooms = useCallback((ws: WebSocket) => {
    for (const g of initialGroupsRef.current) {
      const roomId = groupToRoomId(g);
      ws.send(JSON.stringify({ type: 'join_room', roomId }));
    }
  }, []);

  // ─── Server message handler ──────────────────────────────────────
  // Uses refs for values that change (activeRoom) to avoid stale closures
  const handleServerMessage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any, ws?: WebSocket) => {
      switch (data.type) {
        case 'authenticated':
          setIsConnected(true);
          // Auto-join all group rooms after authentication
          if (ws && ws.readyState === WebSocket.OPEN) {
            autoJoinGroupRooms(ws);
          }
          break;

        case 'message': {
          const msg = data.message as ChatMessageData;
          setMessages((prev) => {
            const next = new Map(prev);
            const roomMsgs = [...(next.get(msg.roomId) || []), msg];
            next.set(msg.roomId, roomMsgs);
            return next;
          });
          // Increment unread if not active room (use ref to avoid stale closure)
          setRooms((prev) => {
            const room = prev.get(msg.roomId);
            if (room && msg.senderId !== userId) {
              const currentActiveRoom = activeRoomRef.current;
              const next = new Map(prev);
              next.set(msg.roomId, {
                ...room,
                unreadCount: room.unreadCount + (currentActiveRoom === msg.roomId ? 0 : 1),
              });
              return next;
            }
            return prev;
          });
          break;
        }

        case 'room_members': {
          // Server sends members currently in the WS room.
          // Merge with existing members instead of replacing, to preserve
          // DB-sourced members who haven't connected via WebSocket yet.
          const { roomId, members: serverMembers } = data as {
            roomId: string;
            members: RoomMember[];
          };
          setRooms((prev) => {
            const room = prev.get(roomId);
            if (room) {
              const next = new Map(prev);
              // Build a map of server-reported online members
              const serverMemberMap = new Map(
                serverMembers.map((m) => [m.userId, m]),
              );
              // Merge: keep all existing members, update online status from server
              const mergedMembers = room.members.map((existing) => {
                const serverInfo = serverMemberMap.get(existing.userId);
                return {
                  ...existing,
                  online: serverInfo ? serverInfo.online : false,
                };
              });
              // Add any new members from server that aren't in existing list
              for (const sm of serverMembers) {
                if (!room.members.some((m) => m.userId === sm.userId)) {
                  mergedMembers.push(sm);
                }
              }
              next.set(roomId, { ...room, members: mergedMembers });
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

        case 'typing':
          // TODO: Show typing indicator in UI
          break;

        case 'room_joined':
          // Room join confirmed
          break;

        case 'activity_comment': {
          // Dispatch to activity comment listeners
          const { activityId, comment } = data as {
            activityId: string;
            comment: ActivityCommentData;
          };
          const listeners = activityCommentListenersRef.current.get(activityId);
          if (listeners) {
            for (const listener of listeners) {
              listener(comment);
            }
          }
          break;
        }

        case 'error':
          console.warn('[Chat]', data.message);
          break;
      }
    },
    [userId, autoJoinGroupRooms],
  );

  // Ref to always access latest handleServerMessage from WebSocket callbacks
  const handleServerMessageRef = useRef(handleServerMessage);
  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
  }, [handleServerMessage]);

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
        // Use ref to always call the latest handler (avoids stale closure)
        handleServerMessageRef.current(data, ws);
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

  // ─── Activity comment real-time support ────────────────────────

  const joinActivity = useCallback((activityId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_activity', activityId }));
    }
  }, []);

  const leaveActivity = useCallback((activityId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_activity', activityId }));
    }
  }, []);

  const subscribeActivityComment = useCallback(
    (activityId: string, listener: ActivityCommentListener) => {
      const listeners = activityCommentListenersRef.current;
      if (!listeners.has(activityId)) {
        listeners.set(activityId, new Set());
      }
      listeners.get(activityId)!.add(listener);
    },
    [],
  );

  const unsubscribeActivityComment = useCallback(
    (activityId: string, listener: ActivityCommentListener) => {
      const listeners = activityCommentListenersRef.current;
      const set = listeners.get(activityId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(activityId);
        }
      }
    },
    [],
  );

  return (
    <ChatContext.Provider
      value={{
        userId,
        isConnected,
        isPopupOpen,
        activeRoom,
        rooms,
        messages,
        onlineUsers,
        friends,
        groups,
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
        joinActivity,
        leaveActivity,
        subscribeActivityComment,
        unsubscribeActivityComment,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
