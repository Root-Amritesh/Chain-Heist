import { mongoLeaderboard } from '../server/mongo-leaderboard.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `https://${host}`);

  // GET /api/leaderboard/status or query param status=1
  if (parsedUrl.pathname.endsWith('/status') || parsedUrl.searchParams.get('status') === '1') {
    const status = mongoLeaderboard.getStatus();
    res.statusCode = 200;
    return res.end(JSON.stringify(status));
  }

  // GET /api/leaderboard
  if (req.method === 'GET') {
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const range = parsedUrl.searchParams.get('range') || 'all';
    const docs = await mongoLeaderboard.getTop(limit, range);
    res.statusCode = 200;
    return res.end(JSON.stringify(docs));
  }

  // POST /api/leaderboard
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      // Buffer from stream if body isn't parsed by Vercel
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
