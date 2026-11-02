import { mongoLeaderboard, checkRateLimit, generateETag } from '../server/mongo-leaderboard.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `https://${host}`);

  // GET status
  if (parsedUrl.pathname.endsWith('/status') || parsedUrl.searchParams.get('status') === '1') {
    const status = mongoLeaderboard.getStatus();
    res.statusCode = 200;
    return res.end(JSON.stringify(status));
  }

  // GET /api/leaderboard or /api/scores
  if (req.method === 'GET') {
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const scope = parsedUrl.searchParams.get('scope') || parsedUrl.searchParams.get('range') || 'all';
    const docs = await mongoLeaderboard.getTop(limit, scope);

    // ETag caching
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

  // POST /api/scores or /api/leaderboard
  if (req.method === 'POST') {
    // 1. IP Rate Limiting (10/min/IP)
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
      .split(',')[0].trim();

    if (!checkRateLimit(clientIp)) {
      res.statusCode = 429;
      return res.end(JSON.stringify({ success: false, error: 'RATE_LIMIT_EXCEEDED' }));
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      body = await new Promise((resolve) => {
        let str = '';
        req.on('data', chunk => { str += chunk; });
        req.on('end', () => {
          try {
            resolve(JSON.parse(str || '{}'));
          } catch {
            resolve({});
          }
        });
      });
    }

    try {
      const result = await mongoLeaderboard.submitScore(body);
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
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ error: 'Method not allowed' }));
}
