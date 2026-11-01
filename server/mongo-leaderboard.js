import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

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

      // Sync any local offline cache into MongoDB
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

  // Load offline cache from data/leaderboard-db.json
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

  // Save to offline cache
  writeOfflineCache(entries) {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[MongoDB Leaderboard] Write offline cache error:', err.message);
    }
  }

  // Sync cache to MongoDB when connection restores
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

  async getTop(limit = 50, range = 'all') {
    // Try reconnecting in background if disconnected
    if (!this.isConnected) {
      this.connect().catch(() => {});
    }

    if (this.isConnected && this.db) {
      try {
        const collection = this.db.collection(COLLECTION_NAME);
        const query = {};
        if (range === 'today') {
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

    // Fallback to local cache
    let list = this.readOfflineCache();
    if (range === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startMs = startOfDay.getTime();
      list = list.filter(e => e.timestamp >= startMs);
    }
    list.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    return list.slice(0, limit);
  }

  async submitScore(entry) {
    if (!entry || !entry.name || typeof entry.score !== 'number') {
      return { success: false, error: 'INVALID_PAYLOAD' };
    }

    const payload = {
      name: String(entry.name).toUpperCase().slice(0, 12),
      score: Math.floor(entry.score),
      districts: Math.max(0, Math.min(4, Number(entry.districts) || 0)),
      tokens: Math.max(0, Math.min(10, Number(entry.tokens) || 0)),
      badge: entry.badge || 'BRONZE',
      verificationCode: entry.verificationCode || `#${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
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

        // Find rank
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
      uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // hide credentials if any
      dbName: DB_NAME,
      error: this.lastError,
    };
  }
}

export const mongoLeaderboard = new MongoLeaderboardService();

