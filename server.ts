import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { ChatServer } from './src/server/chat/ChatServer.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || (dev ? '3450' : '3000'), 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const jwtSecret = process.env.AUTH_SECRET || 'staging_secret_key_2026_local_dev';

app.prepare().then(() => {
  const chatServer = new ChatServer(jwtSecret);

  // Store chat server instance globally for API routes to access
  (globalThis as Record<string, unknown>).__chatServer = chatServer;

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);

      // Internal API endpoint for admin chat stats
      if (parsedUrl.pathname === '/api/internal/chat-stats') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            rooms: chatServer.getRoomList(),
            onlineUsers: chatServer.getOnlineUserCount(),
            messageCounts: chatServer.getMessageCounts(),
          }),
        );
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Handle WebSocket upgrade — only intercept /api/ws for chat
  // Let Next.js internal upgrade handler manage HMR (/_next/webpack-hmr) etc.
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url!, true);

    if (pathname === '/api/ws') {
      chatServer.handleUpgrade(request, socket, head);
    }
    // Don't destroy other upgrade requests — Next.js dev server
    // needs /_next/webpack-hmr for Hot Module Replacement
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/api/ws`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    chatServer.shutdown();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
