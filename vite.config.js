import { defineConfig } from 'vite';
import { mongoLeaderboard, checkRateLimit, generateETag } from './server/mongo-leaderboard.js';
import fs from 'fs';
import path from 'path';

function copyAssetsPlugin() {
  return {
    name: 'copy-game-assets',
    closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'assets');
      const destDir = path.resolve(process.cwd(), 'dist', 'assets');
      if (fs.existsSync(srcDir)) {
        console.log(`[Vite Build] Copying game assets from ${srcDir} to ${destDir}...`);
        fs.cpSync(srcDir, destDir, { recursive: true });
        console.log('[Vite Build] Game assets successfully copied to dist/assets!');
      }
    },
  };
}

export default defineConfig({
  server: {
    port: 5174,
    strictPort: false,
    host: true,
  },
  plugins: [
    copyAssetsPlugin(),
    {
      name: 'api-mongodb-leaderboard',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const isLeaderboard = req.url.startsWith('/api/leaderboard');
          const isScores = req.url.startsWith('/api/scores');

          if (!isLeaderboard && !isScores) {
            return next();
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            return res.end();
          }

          const parsedUrl = new URL(req.url, 'http://localhost');

          // GET status
          if (parsedUrl.pathname === '/api/leaderboard/status' || parsedUrl.searchParams.get('status') === '1') {
            const status = mongoLeaderboard.getStatus();
            res.statusCode = 200;
            return res.end(JSON.stringify(status));
          }

          // GET leaderboard / scores
          if (req.method === 'GET') {
            const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
            const scope = parsedUrl.searchParams.get('scope') || parsedUrl.searchParams.get('range') || 'all';
            const docs = await mongoLeaderboard.getTop(limit, scope);

            const etag = generateETag(docs);
            res.setHeader('ETag', etag);

            const clientETag = req.headers['if-none-match'];
            if (clientETag && clientETag === etag) {
              res.statusCode = 304;
              return res.end();
            }

            res.statusCode = 200;
            return res.end(JSON.stringify(docs));
          }

          // POST leaderboard / scores
          if (req.method === 'POST') {
            const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
              .split(',')[0].trim();

            if (!checkRateLimit(clientIp)) {
              res.statusCode = 429;
              return res.end(JSON.stringify({ success: false, error: 'RATE_LIMIT_EXCEEDED' }));
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const result = await mongoLeaderboard.submitScore(payload);
                if (!result.success) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify(result));
                }
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
