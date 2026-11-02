import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'bithunter';
const COLLECTION_NAME = 'leaderboard';
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'leaderboard-db.json');

// Ensure data folder exists
const dataDir = path.dirname(CACHE_FILE);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.warn('[MongoDB Leaderboard] Could not create data dir:', err.message);
  }
}

// In-memory rate limiting map: ip -> Array<timestamp>
const ipRateLimitMap = new Map();

/**
 * Checks rate limit: max 10 submissions per minute per IP
 * @param {string} ip
 * @returns {boolean}
 */
export function checkRateLimit(ip = '127.0.0.1') {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAllowed = 10;

  let timestamps = ipRateLimitMap.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= maxAllowed) {
    ipRateLimitMap.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  ipRateLimitMap.set(ip, timestamps);
  return true;
}

/**
 * Generates an HTTP ETag for data
 * @param {any} data
 * @returns {string}
 */
export function generateETag(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return '"' + crypto.createHash('md5').update(str).digest('hex') + '"';
}

class MongoLeaderboardService {
  /** @type {MongoClient | null} */
  client = null;
  /** @type {import('mongodb').Db | null} */
  db = null;
  /** @type {boolean} */
  isConnected = false;
  /** @type {boolean} */
  isConnecting = false;
  /** @type {string | null} */
  lastError = null;

  constructor() {
    this.connect().catch(() => {});
  }

  async connect() {
    if (this.isConnected || this.isConnecting) return this.isConnected;
    this.isConnecting = true;
    this.lastError = null;

    try {
      this.client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });

      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      const collection = this.db.collection(COLLECTION_NAME);

      // Create indexes for fast querying and uniqueness
      await collection.createIndex({ score: -1, createdAt: 1 });
      await collection.createIndex({ verificationCode: 1 }, { unique: true });

      this.isConnected = true;
      this.isConnecting = false;
      console.log(`[MongoDB Leaderboard] Connected successfully to ${DB_NAME} at ${MONGODB_URI}`);

      await this.syncOfflineCache();
      return true;
    } catch (err) {
      this.isConnected = false;
      this.isConnecting = false;
      this.lastError = err.message;
      console.warn(`[MongoDB Leaderboard] Notice: MongoDB not reachable (${err.message}). Using local consensus cache.`);
      return false;
    }
  }

  readOfflineCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[MongoDB Leaderboard] Read offline cache error:', err.message);
    }
    return [];
  }

  writeOfflineCache(entries) {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[MongoDB Leaderboard] Write offline cache error:', err.message);
    }
  }

  async syncOfflineCache() {
    if (!this.isConnected || !this.db) return;
    try {
      const cached = this.readOfflineCache();
      if (cached.length === 0) return;

      const collection = this.db.collection(COLLECTION_NAME);
      for (const entry of cached) {
        await collection.updateOne(
          { verificationCode: entry.verificationCode },
          { $set: entry },
          { upsert: true }
        );
      }
      console.log(`[MongoDB Leaderboard] Synced ${cached.length} cached scores to MongoDB.`);
    } catch (err) {
      console.warn('[MongoDB Leaderboard] Error syncing cache:', err.message);
    }
  }

  async getTop(limit = 50, scope = 'all') {
    if (!this.isConnected) {
      this.connect().catch(() => {});
    }

    if (this.isConnected && this.db) {
      try {
        const collection = this.db.collection(COLLECTION_NAME);
        const query = {};
        if (scope === 'today') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          query.createdAt = { $gte: startOfDay };
        }

        const docs = await collection
          .find(query)
          .sort({ score: -1, createdAt: 1 })
          .limit(limit)
          .toArray();

        return docs.map(d => ({
          name: d.name,
          score: d.score,
          districts: d.districts,
          tokens: d.tokens,
          badge: d.badge,
          verificationCode: d.verificationCode,
          timestamp: d.timestamp || (d.createdAt ? new Date(d.createdAt).getTime() : Date.now()),
        }));
      } catch (err) {
        console.warn('[MongoDB Leaderboard] Query failed, falling back to cache:', err.message);
      }
    }

    let list = this.readOfflineCache();
    if (scope === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startMs = startOfDay.getTime();
      list = list.filter(e => e.timestamp >= startMs);
    }
    list.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    return list.slice(0, limit);
  }

  async submitScore(entry) {
    if (!entry) {
      return { success: false, error: 'EMPTY_PAYLOAD' };
    }

    // 1. Validate and sanitize name: 3-12 chars, A-Z 0-9 _ -
    const rawName = String(entry.name || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,12}$/.test(rawName)) {
      return { success: false, error: 'INVALID_NAME_SCHEMA' };
    }

    // 2. Anti-cheat & Plausibility: 0 <= score <= 50000
    const rawScore = Number(entry.score);
    if (typeof entry.score !== 'number' || isNaN(rawScore) || rawScore < 0 || rawScore > 50000) {
      return { success: false, error: 'IMPLAUSIBLE_SCORE' };
    }

    const payload = {
      name: rawName,
      score: Math.floor(rawScore),
      districts: Math.max(0, Math.min(4, Number(entry.districts) || 0)),
      tokens: Math.max(0, Math.min(10, Number(entry.tokens) || 0)),
      badge: entry.badge || 'BRONZE',
      verificationCode: entry.verificationCode || entry.runId || `#${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
      createdAt: new Date(entry.timestamp || Date.now()),
      timestamp: entry.timestamp || Date.now(),
    };

    // Always mirror to offline cache
    const cache = this.readOfflineCache();
    const existingIndex = cache.findIndex(e => e.verificationCode === payload.verificationCode);
    if (existingIndex !== -1) {
      cache[existingIndex] = payload;
    } else {
      cache.push(payload);
    }
    cache.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    this.writeOfflineCache(cache.slice(0, 100));

    // Try submitting to MongoDB
    if (!this.isConnected) {
      await this.connect().catch(() => {});
    }

    if (this.isConnected && this.db) {
      try {
        const collection = this.db.collection(COLLECTION_NAME);
        await collection.updateOne(
          { verificationCode: payload.verificationCode },
          { $set: payload },
          { upsert: true }
        );

        const higherCount = await collection.countDocuments({ score: { $gt: payload.score } });
        return { success: true, rank: higherCount + 1, entry: payload, isMongo: true };
      } catch (err) {
        console.warn('[MongoDB Leaderboard] MongoDB insert error:', err.message);
      }
    }

    const localRank = cache.findIndex(e => e.verificationCode === payload.verificationCode) + 1;
    return { success: true, rank: localRank || cache.length, entry: payload, isMongo: false };
  }

  getStatus() {
    return {
      connected: this.isConnected,
      db: 'mongodb',
      uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      dbName: DB_NAME,
      error: this.lastError,
    };
  }
}

export const mongoLeaderboard = new MongoLeaderboardService();
