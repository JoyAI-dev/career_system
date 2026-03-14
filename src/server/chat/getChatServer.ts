import type { ChatServer } from './ChatServer';

/**
 * Get the ChatServer singleton from globalThis.
 * This only works in the custom server (server.ts) environment,
 * NOT in serverless deployments.
 */
export function getChatServer(): ChatServer | null {
  return (
    (globalThis as Record<string, unknown>).__chatServer as ChatServer | null
  ) ?? null;
}
