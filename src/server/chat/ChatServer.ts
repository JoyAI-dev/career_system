import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { jwtVerify } from 'jose';

// ─── Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  mentions: string[];
  timestamp: number;
}

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  username?: string;
  isAlive?: boolean;
}

interface RoomInfo {
  type: 'community' | 'group' | 'private';
  name: string;
  members: Set<string>;
}

type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'join_room'; roomId: string }
  | { type: 'leave_room'; roomId: string }
  | { type: 'message'; roomId: string; content: string; mentions?: string[] }
  | { type: 'typing'; roomId: string };

type ServerMessage =
  | { type: 'authenticated'; userId: string; username: string }
  | { type: 'error'; message: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'typing'; roomId: string; userId: string; username: string }
  | { type: 'user_online'; userId: string; username: string }
  | { type: 'user_offline'; userId: string }
  | { type: 'room_members'; roomId: string; members: { userId: string; username: string; online: boolean }[] }
  | { type: 'room_joined'; roomId: string }
  | { type: 'message_counts'; counts: Record<string, number> };

// ─── ChatServer ───────────────────────────────────────────────────────

export class ChatServer {
  private wss: WebSocketServer;
  private rooms: Map<string, RoomInfo> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();
  private onlineUsers: Map<string, Set<AuthenticatedSocket>> = new Map();
  private userNames: Map<string, string> = new Map();
  private messageCounts: Map<string, number> = new Map();
  private jwtSecret: Uint8Array;
  private messageIdCounter = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(jwtSecret: string) {
    this.jwtSecret = new TextEncoder().encode(jwtSecret);
    this.wss = new WebSocketServer({ noServer: true });
    this.setupHeartbeat();
  }

  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const socket = ws as AuthenticatedSocket;
        if (socket.isAlive === false) {
          this.handleDisconnect(socket);
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, 30000);
  }

  handleUpgrade(request: IncomingMessage, socket: import('stream').Duplex, head: Buffer) {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
      this.handleConnection(ws as AuthenticatedSocket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        this.handleMessage(socket, message);
      } catch {
        this.send(socket, { type: 'error', message: 'Invalid message format' });
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(socket);
    });

    socket.on('error', () => {
      this.handleDisconnect(socket);
    });
  }

  private async handleMessage(socket: AuthenticatedSocket, message: ClientMessage) {
    switch (message.type) {
      case 'auth':
        await this.handleAuth(socket, message.token);
        break;
      case 'join_room':
        if (!socket.userId) return this.send(socket, { type: 'error', message: 'Not authenticated' });
        this.handleJoinRoom(socket, message.roomId);
        break;
      case 'leave_room':
        if (!socket.userId) return this.send(socket, { type: 'error', message: 'Not authenticated' });
        this.handleLeaveRoom(socket, message.roomId);
        break;
      case 'message':
        if (!socket.userId) return this.send(socket, { type: 'error', message: 'Not authenticated' });
        this.handleChatMessage(socket, message.roomId, message.content, message.mentions || []);
        break;
      case 'typing':
        if (!socket.userId) return this.send(socket, { type: 'error', message: 'Not authenticated' });
        this.handleTyping(socket, message.roomId);
        break;
    }
  }

  private async handleAuth(socket: AuthenticatedSocket, token: string) {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      });

      const userId = (payload as Record<string, unknown>).userId as string;
      const username = (payload as Record<string, unknown>).username as string;

      if (!userId || !username) {
        return this.send(socket, { type: 'error', message: 'Invalid token' });
      }

      socket.userId = userId;
      socket.username = username;

      // Track online user
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(socket);
      this.userNames.set(userId, username);

      // Notify others
      this.broadcastToAll({ type: 'user_online', userId, username }, socket);

      this.send(socket, { type: 'authenticated', userId, username });
    } catch {
      this.send(socket, { type: 'error', message: 'Authentication failed' });
    }
  }

  private handleJoinRoom(socket: AuthenticatedSocket, roomId: string) {
    if (!socket.userId) return;

    // Create room if not exists
    if (!this.rooms.has(roomId)) {
      const type = roomId.startsWith('community:')
        ? 'community'
        : roomId.startsWith('group:')
          ? 'group'
          : 'private';
      this.rooms.set(roomId, { type, name: roomId, members: new Set() });
    }

    const room = this.rooms.get(roomId)!;
    room.members.add(socket.userId);

    // Send recent messages
    const recentMessages = this.messages.get(roomId) || [];
    for (const msg of recentMessages) {
      this.send(socket, { type: 'message', message: msg });
    }

    // Send room members
    this.sendRoomMembers(roomId);
    this.send(socket, { type: 'room_joined', roomId });
  }

  private handleLeaveRoom(socket: AuthenticatedSocket, roomId: string) {
    if (!socket.userId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.members.delete(socket.userId);
      if (room.members.size === 0) {
        this.rooms.delete(roomId);
      } else {
        this.sendRoomMembers(roomId);
      }
    }
  }

  private handleChatMessage(socket: AuthenticatedSocket, roomId: string, content: string, mentions: string[]) {
    if (!socket.userId || !socket.username) return;

    // Sanitize content - text only, max 2000 chars
    const sanitized = content.trim().slice(0, 2000);
    if (!sanitized) return;

    const room = this.rooms.get(roomId);
    if (!room || !room.members.has(socket.userId)) {
      return this.send(socket, { type: 'error', message: 'Not in room' });
    }

    const chatMessage: ChatMessage = {
      id: `msg_${++this.messageIdCounter}_${Date.now()}`,
      roomId,
      senderId: socket.userId,
      senderName: socket.username,
      content: sanitized,
      mentions,
      timestamp: Date.now(),
    };

    // Store message (cap at 200 per room)
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, []);
    }
    const roomMessages = this.messages.get(roomId)!;
    roomMessages.push(chatMessage);
    if (roomMessages.length > 200) {
      roomMessages.shift();
    }

    // Update count
    this.messageCounts.set(roomId, (this.messageCounts.get(roomId) || 0) + 1);

    // Broadcast to room members
    this.broadcastToRoom(roomId, { type: 'message', message: chatMessage });
  }

  private handleTyping(socket: AuthenticatedSocket, roomId: string) {
    if (!socket.userId || !socket.username) return;

    const room = this.rooms.get(roomId);
    if (!room || !room.members.has(socket.userId)) return;

    this.broadcastToRoom(
      roomId,
      { type: 'typing', roomId, userId: socket.userId, username: socket.username },
      socket,
    );
  }

  private handleDisconnect(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    const userSockets = this.onlineUsers.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        this.onlineUsers.delete(socket.userId);
        // Notify others
        this.broadcastToAll({ type: 'user_offline', userId: socket.userId });
        // Remove from rooms
        for (const [roomId, room] of this.rooms) {
          room.members.delete(socket.userId);
          if (room.members.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      }
    }
  }

  private sendRoomMembers(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const members = Array.from(room.members).map((userId) => ({
      userId,
      username: this.userNames.get(userId) || 'Unknown',
      online: this.onlineUsers.has(userId),
    }));

    this.broadcastToRoom(roomId, { type: 'room_members', roomId, members });
  }

  private broadcastToRoom(roomId: string, message: ServerMessage, excludeSocket?: AuthenticatedSocket) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const userId of room.members) {
      const sockets = this.onlineUsers.get(userId);
      if (sockets) {
        for (const socket of sockets) {
          if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
            this.send(socket, message);
          }
        }
      }
    }
  }

  private broadcastToAll(message: ServerMessage, excludeSocket?: AuthenticatedSocket) {
    this.wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;
      if (socket !== excludeSocket && socket.userId && socket.readyState === WebSocket.OPEN) {
        this.send(socket, message);
      }
    });
  }

  private send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  // ─── Public API (for admin stats) ────────────────────────────────

  getMessageCounts(): Record<string, number> {
    return Object.fromEntries(this.messageCounts);
  }

  getOnlineUserCount(): number {
    return this.onlineUsers.size;
  }

  getRoomList(): { roomId: string; type: string; memberCount: number; messageCount: number }[] {
    return Array.from(this.rooms.entries()).map(([roomId, room]) => ({
      roomId,
      type: room.type,
      memberCount: room.members.size,
      messageCount: this.messageCounts.get(roomId) || 0,
    }));
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}
