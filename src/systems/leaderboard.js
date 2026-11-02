import { MAX_POSSIBLE_SCORE, SCORE_SUBMISSION_RATE_LIMIT_MS } from '../config.js';

const LOCAL_STORAGE_KEY = 'CHAIN_HEIST_LEADERBOARD_ENTRIES';
const OFFLINE_QUEUE_KEY = 'CHAIN_HEIST_OFFLINE_QUEUE';
const LAST_SUBMISSION_TIME_KEY = 'CHAIN_HEIST_LAST_SUBMIT_TIME';
const PLAYER_NAME_KEY = 'CHAIN_HEIST_PLAYER_NAME';

/**
 * @typedef {object} LeaderboardEntry
 * @property {string} name
 * @property {number} score
 * @property {number} districts
 * @property {number} tokens
 * @property {string} badge
 * @property {number} timestamp
 * @property {string} verificationCode
 * @property {string} [hunter]
 * @property {string} [runCode]
 */

/**
 * Local storage adapter (offline fallback, deduplicated)
 */
export class LocalAdapter {
  constructor() {
    this.isOnline = false;
  }

  /**
   * @returns {LeaderboardEntry[]}
   */
  getAll() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * @param {LeaderboardEntry} entry
   * @returns {Promise<{ success: boolean, rank: number, entry: LeaderboardEntry }>}
   */
  async submitScore(entry) {
    const list = this.getAll();
    const existingIndex = list.findIndex(e => e.verificationCode === entry.verificationCode);
    if (existingIndex !== -1) {
      list[existingIndex] = { ...list[existingIndex], ...entry };
    } else {
      list.push(entry);
    }

    list.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    const trimmed = list.slice(0, 100);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
      } catch (err) {
        console.warn('[Leaderboard] LocalStorage write failed', err);
      }
    }

    const rank = trimmed.findIndex(e => e.verificationCode === entry.verificationCode) + 1;
    return { success: true, rank: rank || trimmed.length, entry };
  }

  /**
   * @param {number} [n=50]
   * @param {'all' | 'today'} [scope='all']
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(n = 50, scope = 'all') {
    let list = this.getAll();
    if (scope === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startMs = startOfDay.getTime();
      list = list.filter(e => e.timestamp >= startMs);
    }
    list.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    return list.slice(0, n);
  }
}

/**
 * Remote API adapter with offline queue, ETag caching, and exponential backoff
 */
export class RemoteAdapter {
  /**
   * @param {LocalAdapter} localFallback
   */
  constructor(localFallback) {
    this.localFallback = localFallback;
    this.isOnline = false;
    this.isMongo = false;
    this.lastChecked = 0;
    this.#cachedETags = new Map();
    this.#cachedResponses = new Map();

    // Listen for online events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processOfflineQueue();
      });
    }

    this.checkStatus();
  }

  /** @type {Map<string, string>} */
  #cachedETags;
  /** @type {Map<string, LeaderboardEntry[]>} */
  #cachedResponses;

  async checkStatus() {
    try {
      const res = await fetch('/api/leaderboard/status');
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        this.isMongo = Boolean(data.connected);
        this.lastChecked = Date.now();
        // Trigger queue retry if reconnected
        this.processOfflineQueue();
      }
    } catch {
      this.isOnline = false;
      this.isMongo = false;
    }
  }

  /**
   * Reads offline queued submissions
   * @returns {LeaderboardEntry[]}
   */
  getOfflineQueue() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Adds entry to offline queue
   * @param {LeaderboardEntry} entry
   */
  addToOfflineQueue(entry) {
    if (typeof localStorage === 'undefined') return;
    try {
      const queue = this.getOfflineQueue();
      if (!queue.some(e => e.verificationCode === entry.verificationCode)) {
        queue.push(entry);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (err) {
      console.warn('[Leaderboard] Queue error:', err);
    }
  }

  /**
   * Flushes offline queue with exponential backoff retry
   */
  async processOfflineQueue(retryCount = 0) {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const entry of queue) {
      try {
        const res = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (!res.ok && res.status !== 400) {
          remaining.push(entry);
        }
      } catch {
        remaining.push(entry);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      } catch {}
    }

    if (remaining.length > 0 && retryCount < 4) {
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => this.processOfflineQueue(retryCount + 1), delay);
    }
  }

  /**
   * @param {LeaderboardEntry} entry
   * @returns {Promise<{ success: boolean, rank?: number, entry?: LeaderboardEntry }>}
   */
  async submitScore(entry) {
    // 1. Optimistic insert into local store first
    await this.localFallback.submitScore(entry);

    // 2. Attempt remote submission
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: entry.name,
          score: entry.score,
          districts: entry.districts,
          tokens: entry.tokens,
          badge: entry.badge,
          verificationCode: entry.verificationCode,
          timestamp: entry.timestamp,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        if (data.isMongo) {
          this.isMongo = true;
        }
        return { success: true, entry: data.entry || entry, rank: data.rank };
      } else {
        // If server failed (e.g. offline/500), queue it
        this.addToOfflineQueue(entry);
      }
    } catch (err) {
      console.warn('[Leaderboard] Remote submit failed; queued for offline sync', err);
      this.isOnline = false;
      this.addToOfflineQueue(entry);
    }

    return this.localFallback.submitScore(entry);
  }

  /**
   * @param {number} [n=50]
   * @param {'all' | 'today'} [scope='all']
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(n = 50, scope = 'all') {
    const cacheKey = `${scope}_${n}`;
    const headers = {};
    const existingETag = this.#cachedETags.get(cacheKey);
    if (existingETag) {
      headers['If-None-Match'] = existingETag;
    }

    try {
      const res = await fetch(`/api/leaderboard?limit=${n}&scope=${scope}`, { headers });
      if (res.status === 304) {
        // Re-use cached response
        this.isOnline = true;
        return this.#cachedResponses.get(cacheKey) || this.localFallback.getTop(n, scope);
      }

      if (res.ok) {
        const rows = await res.json();
        this.isOnline = true;
        const newETag = res.headers.get('ETag');
        if (newETag) {
          this.#cachedETags.set(cacheKey, newETag);
        }

        if (Array.isArray(rows) && rows.length > 0) {
          const mapped = rows.map(r => ({
            name: r.name,
            score: r.score,
            districts: r.districts,
            tokens: r.tokens,
            badge: r.badge,
            timestamp: r.timestamp || (r.createdAt ? new Date(r.createdAt).getTime() : Date.now()),
            verificationCode: r.verificationCode,
          }));
          this.#cachedResponses.set(cacheKey, mapped);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[Leaderboard] Remote getTop failed, falling back to local consensus', err);
      this.isOnline = false;
    }

    return this.localFallback.getTop(n, scope);
  }
}

/**
 * Unified Leaderboard Service
 */
class LeaderboardService {
  /** @type {LocalAdapter} */
  #localAdapter;
  /** @type {RemoteAdapter} */
  #remoteAdapter;
  /** @type {Set<(entries: LeaderboardEntry[]) => void>} */
  #subscribers = new Set();
  /** @type {number | null} */
  #pollTimer = null;
  /** @type {LeaderboardEntry | null} */
  #latestSubmission = null;
  /** @type {number} */
  #lastFetchTime = 0;

  constructor() {
    this.#localAdapter = new LocalAdapter();
    this.#remoteAdapter = new RemoteAdapter(this.#localAdapter);
  }

  get isRemoteEnabled() {
    return this.#remoteAdapter.isOnline;
  }

  get isMongoConnected() {
    return this.#remoteAdapter.isMongo;
  }

  get latestSubmission() {
    return this.#latestSubmission;
  }

  get lastFetchTime() {
    return this.#lastFetchTime;
  }

  /**
   * Sanitize player name (3-12 alphanumeric characters + dash/underscore)
   * @param {string} raw
   * @returns {string}
   */
  sanitizeName(raw) {
    if (!raw || typeof raw !== 'string') {
      return this.getDefaultHandle();
    }
    let cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
    if (cleaned.length < 3) {
      cleaned = cleaned.padEnd(3, '0');
    }
    return cleaned.slice(0, 12);
  }

  /**
   * Generates default ANON-xxxx handle
   * @returns {string}
   */
  getDefaultHandle() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(PLAYER_NAME_KEY);
      if (saved && /^[A-Z0-9_-]{3,12}$/i.test(saved.trim())) {
        return saved.trim().toUpperCase();
      }
    }
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ANON-${rand}`;
  }

  /**
   * Persists handle in localStorage
   * @param {string} name
   */
  saveHandle(name) {
    const sanitized = this.sanitizeName(name);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(PLAYER_NAME_KEY, sanitized);
      } catch {}
    }
    return sanitized;
  }

  /**
   * Submit score with anti-cheat checks
   * @param {LeaderboardEntry} entry
   * @returns {Promise<{ success: boolean, rank?: number, error?: string }>}
   */
  async submitScore(entry) {
    const sanitizedName = this.sanitizeName(entry.name);

    // Anti-cheat: Score bounds check
    if (typeof entry.score !== 'number' || entry.score < 0 || entry.score > MAX_POSSIBLE_SCORE) {
      console.error(`[Leaderboard Anti-Cheat] Rejected invalid score: ${entry.score}`);
      return { success: false, error: 'INVALID_SCORE' };
    }

    // Rate limiting check
    const now = Date.now();
    if (typeof localStorage !== 'undefined') {
      const lastSubmit = parseInt(localStorage.getItem(LAST_SUBMISSION_TIME_KEY) || '0', 10);
      if (now - lastSubmit < SCORE_SUBMISSION_RATE_LIMIT_MS) {
        console.warn('[Leaderboard] Client rate limit throttled submission');
        return { success: false, error: 'RATE_LIMITED' };
      }
      localStorage.setItem(LAST_SUBMISSION_TIME_KEY, String(now));
    }

    const payload = {
      name: sanitizedName,
      score: Math.floor(entry.score),
      districts: Math.max(0, Math.min(4, entry.districts || 0)),
      tokens: Math.max(0, Math.min(10, entry.tokens || 0)),
      badge: entry.badge || 'NONE',
      timestamp: entry.timestamp || now,
      verificationCode: entry.verificationCode || `#${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
    };

    this.#latestSubmission = payload;

    const res = await this.#remoteAdapter.submitScore(payload);
    this.#lastFetchTime = Date.now();
    this.notifySubscribers();
    return res;
  }

  /**
   * @param {number} [n=50]
   * @param {'all' | 'today'} [scope='all']
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(n = 50, scope = 'all') {
    const entries = await this.#remoteAdapter.getTop(n, scope);
    this.#lastFetchTime = Date.now();
    return entries;
  }

  async checkConnection() {
    await this.#remoteAdapter.checkStatus();
  }

  subscribe(callback) {
    this.#subscribers.add(callback);
    return () => {
      this.#subscribers.delete(callback);
    };
  }

  async notifySubscribers() {
    if (this.#subscribers.size === 0) return;
    const entries = await this.getTop(50, 'all');
    this.#subscribers.forEach(cb => {
      try { cb(entries); } catch (err) { console.error(err); }
    });
  }

  /**
   * Polls every 10 seconds while the ledger is open
   * @param {() => void} onUpdate
   * @returns {() => void} stopPolling function
   */
  startLedgerPolling(onUpdate) {
    let lastActivityTime = Date.now();

    const activityHandler = () => {
      lastActivityTime = Date.now();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', activityHandler, { passive: true });
      window.addEventListener('keydown', activityHandler, { passive: true });
    }

    const timer = setInterval(async () => {
      // 30s idle check
      if (Date.now() - lastActivityTime > 30000) {
        return;
      }
      if (onUpdate) {
        try {
          await onUpdate();
        } catch {}
      }
    }, 10000);

    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', activityHandler);
        window.removeEventListener('keydown', activityHandler);
      }
    };
  }
}

export const leaderboard = new LeaderboardService();
