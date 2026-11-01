import { MAX_POSSIBLE_SCORE, SCORE_SUBMISSION_RATE_LIMIT_MS } from '../config.js';

const LOCAL_STORAGE_KEY = 'CHAIN_HEIST_LEADERBOARD_ENTRIES';
const LAST_SUBMISSION_TIME_KEY = 'CHAIN_HEIST_LAST_SUBMIT_TIME';

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
 * @property {number} [cleared]
 */

/**
 * Local storage adapter (offline fallback, top 50, deduplicated)
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
      return { success: true, rank: existingIndex + 1, entry: list[existingIndex] };
    }

    list.push(entry);
    list.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    const trimmed = list.slice(0, 50);

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
   * @param {'all' | 'today'} [range='all']
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(n = 50, range = 'all') {
    let list = this.getAll();
    if (range === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startMs = startOfDay.getTime();
      list = list.filter(e => e.timestamp >= startMs);
    }
    return list.slice(0, n);
  }
}

/**
 * Remote MongoDB API adapter with automatic offline fallback
 */
export class RemoteAdapter {
  /**
   * @param {LocalAdapter} localFallback
   */
  constructor(localFallback) {
    this.localFallback = localFallback;
    this.isOnline = false;
    this.isMongo = false;
    this.checkStatus();
  }

  async checkStatus() {
    try {
      const res = await fetch('/api/leaderboard/status');
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        this.isMongo = Boolean(data.connected);
      }
    } catch {
      this.isOnline = false;
      this.isMongo = false;
    }
  }

  /**
   * @param {LeaderboardEntry} entry
   * @returns {Promise<{ success: boolean, rank?: number, entry?: LeaderboardEntry }>}
   */
  async submitScore(entry) {
    // Always mirror to local first
    await this.localFallback.submitScore(entry);

    try {
      const res = await fetch('/api/leaderboard', {
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
      }
    } catch (err) {
      console.warn('[Leaderboard] Remote MongoDB submit failed, falling back to local', err);
    }

    return this.localFallback.submitScore(entry);
  }

  /**
   * @param {number} [n=50]
   * @param {'all' | 'today'} [range='all']
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(n = 50, range = 'all') {
    try {
      const res = await fetch(`/api/leaderboard?limit=${n}&range=${range}`);
      if (res.ok) {
        const rows = await res.json();
        this.isOnline = true;
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map(r => ({
            name: r.name,
            score: r.score,
            districts: r.districts,
            tokens: r.tokens,
            badge: r.badge,
            timestamp: r.timestamp || (r.createdAt ? new Date(r.createdAt).getTime() : Date.now()),
            verificationCode: r.verificationCode,
          }));
        }
      }
    } catch (err) {
      console.warn('[Leaderboard] Remote getTop failed, falling back to local', err);
    }

    return this.localFallback.getTop(n, range);
  }
}

/**
 * Unified Leaderboard Service with validation and anti-cheat
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

  constructor() {
    this.#localAdapter = new LocalAdapter();
    this.#remoteAdapter = new RemoteAdapter(this.#localAdapter);

    this.startPolling();
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

  /**
   * Sanitize player name (3-12 alphanumeric uppercase characters)
   * @param {string} raw
   * @returns {string}
   */
  sanitizeName(raw) {
    if (!raw || typeof raw !== 'string') return 'HUNTER_01';
    const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
    if (cleaned.length < 3) return cleaned.padEnd(3, '_');
    return cleaned.slice(0, 12);
  }

  /**
   * Submit score with anti-cheat checks
   * @param {LeaderboardEntry} entry
   * @returns {Promise<{ success: boolean, rank?: number, error?: string }>}
   */
  async submitScore(entry) {
    // 1. Sanitize name
    const sanitizedName = this.sanitizeName(entry.name);

    // 2. Anti-cheat: Score bounds check
    if (typeof entry.score !== 'number' || entry.score < 0 || entry.score > MAX_POSSIBLE_SCORE) {
      console.error(`[Leaderboard Anti-Cheat] Rejected invalid score: ${entry.score} (Max allowed: ${MAX_POSSIBLE_SCORE})`);
      return { success: false, error: 'INVALID_SCORE' };
    }

    // 3. Anti-cheat: Verification code validation
    if (!entry.verificationCode || !/^#[0-9A-F]{4}-[0-9A-F]{4}$/i.test(entry.verificationCode)) {
      console.error(`[Leaderboard Anti-Cheat] Rejected missing or malformed verification code: ${entry.verificationCode}`);
      return { success: false, error: 'INVALID_VERIFICATION_CODE' };
    }

    // 4. Anti-cheat: Rate limiting check
    const now = Date.now();
    if (typeof localStorage !== 'undefined') {
      const lastSubmit = parseInt(localStorage.getItem(LAST_SUBMISSION_TIME_KEY) || '0', 10);
      if (now - lastSubmit < SCORE_SUBMISSION_RATE_LIMIT_MS) {
        console.warn(`[Leaderboard Anti-Cheat] Rate limit exceeded (${now - lastSubmit}ms < ${SCORE_SUBMISSION_RATE_LIMIT_MS}ms)`);
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
      verificationCode: entry.verificationCode,
    };

    this.#latestSubmission = payload;

    const res = await this.#remoteAdapter.submitScore(payload);
    this.notifySubscribers();
    return res;
  }

  /**
   * @param {number} [n=50]
   * @param {'all' | 'today'} [range='all']
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(n = 50, range = 'all') {
    return this.#remoteAdapter.getTop(n, range);
  }

  /**
   * Refresh connection status
   */
  async checkConnection() {
    await this.#remoteAdapter.checkStatus();
  }

  /**
   * Subscribe to updates
   * @param {(entries: LeaderboardEntry[]) => void} callback
   * @returns {() => void} Unsubscribe function
   */
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

  startPolling() {
    if (this.#pollTimer) return;
    this.#pollTimer = setInterval(() => {
      if (this.isRemoteEnabled && this.#subscribers.size > 0) {
        this.notifySubscribers();
      }
    }, 15000);
  }

  stopPolling() {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
  }
}

export const leaderboard = new LeaderboardService();
