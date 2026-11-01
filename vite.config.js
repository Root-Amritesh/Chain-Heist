import { defineConfig } from 'vite';
import { mongoLeaderboard } from './server/mongo-leaderboard.js';

export default defineConfig({
  server: {
    port: 5174,
    strictPort: false,
    host: true,
  },
  plugins: [
    {
      name: 'api-mongodb-leaderboard',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith('/api/leaderboard')) {
            return next();
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            return res.end();
          }

          const parsedUrl = new URL(req.url, 'http://localhost');

          // GET /api/leaderboard/status
          if (parsedUrl.pathname === '/api/leaderboard/status') {
            const status = mongoLeaderboard.getStatus();
            res.statusCode = 200;
            return res.end(JSON.stringify(status));
          }

          // GET /api/leaderboard
          if (req.method === 'GET' && parsedUrl.pathname === '/api/leaderboard') {
            const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
            const range = parsedUrl.searchParams.get('range') || 'all';
            const docs = await mongoLeaderboard.getTop(limit, range);
            res.statusCode = 200;
            return res.end(JSON.stringify(docs));
          }

          // POST /api/leaderboard
          if (req.method === 'POST' && parsedUrl.pathname === '/api/leaderboard') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const result = await mongoLeaderboard.submitScore(payload);
                res.statusCode = 200;
                return res.end(JSON.stringify(result));
              } catch (err) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          next();
        });
      },
    },
  ],
});
