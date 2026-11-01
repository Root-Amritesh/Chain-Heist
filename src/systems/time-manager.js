/**
 * TIME MANAGER - Single Source of Truth for Overworld & Minigame Time
 * BIT-HUNTER 2099
 */

const STORAGE_KEY = 'BIT_HUNTER_TIME_STATE';

export const MINIGAME_TIME_LIMIT_SEC = 90;
export const WORLD_STARTING_TIME_SEC = 420; // 07:00
export const HEARTBEAT_INTERVAL_MS = 1000;
export const MAX_FRAME_DELTA_MS = 100;

export const SESSION_END_REASONS = Object.freeze({
  WIN: 'WIN',
  DEFEAT: 'DEFEAT',
  TIMEOUT: 'TIMEOUT',
  PLAYER_QUIT: 'PLAYER_QUIT',
  OVERLAY_CLOSED: 'OVERLAY_CLOSED',
  WORLD_TIME_UP: 'WORLD_TIME_UP',
  ABANDONED: 'ABANDONED',
});

/**
 * @typedef ActiveSession
 * @type {object}
 * @property {string} sessionId
 * @property {string} gameId
 * @property {number} sessionLimitMs
 * @property {number} elapsedMs
 * @property {number} lastHeartbeatTimestamp
 * @property {boolean} ended
 */

class TimeManagerClass {
  /** @type {number} */
  #worldRemainingMs = WORLD_STARTING_TIME_SEC * 1000;

  /** @type {boolean} */
  #isPaused = false;

  /** @type {boolean} */
  #isInitialized = false;

  /** @type {ActiveSession | null} */
  #activeSession = null;

  /** @type {number} */
  #lastHeartbeatSaveMs = 0;

  constructor() {
    this.load();
  }

  /**
   * Initializes or loads persisted state.
   * If a session was left mid-progress (page refresh), subtracts elapsed and marks abandoned.
   */
  load() {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.worldRemainingMs === 'number') {
          this.#worldRemainingMs = Math.max(0, data.worldRemainingMs);
        }

        // Mid-session crash/refresh recovery: deduct heartbeat elapsed and abandon session
        if (data.activeSession && !data.activeSession.ended && data.activeSession.elapsedMs > 0) {
          const abandonedElapsed = Math.min(data.activeSession.elapsedMs, this.#worldRemainingMs);
          this.#worldRemainingMs = Math.max(0, this.#worldRemainingMs - abandonedElapsed);
          console.warn(`[TimeManager] Recovered from mid-session refresh. Deducted ${abandonedElapsed}ms from world time.`);
        }
      }
    } catch (err) {
      console.error('[TimeManager] Error loading state:', err);
    }

    this.#activeSession = null;
    this.#isPaused = false;
    this.#isInitialized = true;
    this.save();
  }

  /**
   * Resets world time back to full starting duration
   * @param {number} [startingSec=WORLD_STARTING_TIME_SEC]
   */
  reset(startingSec = WORLD_STARTING_TIME_SEC) {
    this.#worldRemainingMs = startingSec * 1000;
    this.#activeSession = null;
    this.#isPaused = false;
    this.save();
  }

  /**
   * Persists time state to localStorage
   */
  save() {
    if (typeof localStorage === 'undefined') return;
    try {
      const state = {
        worldRemainingMs: this.#worldRemainingMs,
        activeSession: this.#activeSession ? {
          sessionId: this.#activeSession.sessionId,
          gameId: this.#activeSession.gameId,
          sessionLimitMs: this.#activeSession.sessionLimitMs,
          elapsedMs: this.#activeSession.elapsedMs,
          ended: this.#activeSession.ended,
        } : null,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[TimeManager] Error saving state:', err);
    }
  }

  pause() {
    this.#isPaused = true;
  }

  resume() {
    this.#isPaused = false;
  }

  get isPaused() {
    return this.#isPaused;
  }

  get worldRemainingMs() {
    return this.#worldRemainingMs;
  }

  get worldRemainingSec() {
    return Math.max(0, Math.ceil(this.#worldRemainingMs / 1000));
  }

  get activeSession() {
    return this.#activeSession;
  }

  /**
   * Begins a minigame session.
   * Pauses overworld countdown and returns sessionId and session limit.
   * @param {string} gameId
   * @returns {{ sessionId: string, sessionLimitMs: number, sessionLimitSec: number } | null}
   */
  beginSession(gameId) {
    if (this.#worldRemainingMs <= 0) {
      console.warn('[TimeManager] Cannot begin session: World time expired!');
      return null;
    }

    const sessionLimitMs = Math.min(MINIGAME_TIME_LIMIT_SEC * 1000, this.#worldRemainingMs);
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    this.#activeSession = {
      sessionId,
      gameId,
      sessionLimitMs,
      elapsedMs: 0,
      lastHeartbeatTimestamp: Date.now(),
      ended: false,
    };

    this.#lastHeartbeatSaveMs = 0;
    this.save();
    console.log(`[TimeManager] Session began: ${gameId} (${sessionId}), limit: ${sessionLimitMs / 1000}s`);

    return {
      sessionId,
      sessionLimitMs,
      sessionLimitSec: Math.ceil(sessionLimitMs / 1000),
    };
  }

  /**
   * Updates time accumulator. Call in scene update(time, delta).
   * @param {number} deltaMs
   * @returns {{ worldExpired: boolean, sessionExpired: boolean }}
   */
  tick(deltaMs) {
    if (this.#isPaused) {
      return { worldExpired: false, sessionExpired: false };
    }

    const clampedDelta = Math.min(Math.max(0, deltaMs), MAX_FRAME_DELTA_MS);

    if (!this.#activeSession) {
      // Overworld running
      this.#worldRemainingMs = Math.max(0, this.#worldRemainingMs - clampedDelta);
      const worldExpired = this.#worldRemainingMs <= 0;
      return { worldExpired, sessionExpired: false };
    }

    // Minigame session active
    this.#activeSession.elapsedMs += clampedDelta;

    // Heartbeat every 1000ms
    this.#lastHeartbeatSaveMs += clampedDelta;
    if (this.#lastHeartbeatSaveMs >= HEARTBEAT_INTERVAL_MS) {
      this.#lastHeartbeatSaveMs = 0;
      this.save();
    }

    const sessionExpired = this.#activeSession.elapsedMs >= this.#activeSession.sessionLimitMs;
    // World time remaining considering live minigame progress
    const liveWorldRemaining = this.#worldRemainingMs - this.#activeSession.elapsedMs;
    const worldExpired = liveWorldRemaining <= 0;

    return { worldExpired, sessionExpired };
  }

  /**
   * Ends a minigame session idempotently.
   * Deducts actual elapsed time from overworld countdown.
   * @param {string} sessionId
   * @param {string} reason
   * @returns {{ elapsedMs: number, elapsedSec: number, worldRemainingMs: number, worldRemainingSec: number } | null}
   */
  endSession(sessionId, reason = SESSION_END_REASONS.WIN) {
    if (!this.#activeSession || this.#activeSession.sessionId !== sessionId) {
      // Idempotency: if already ended or not active, ignore gracefully
      return null;
    }

    if (this.#activeSession.ended) {
      return null;
    }

    this.#activeSession.ended = true;

    // Subtract actual elapsed time, capped at what remained
    const actualElapsedMs = Math.min(this.#activeSession.elapsedMs, this.#worldRemainingMs);
    const worldBefore = this.#worldRemainingMs;
    this.#worldRemainingMs = Math.max(0, this.#worldRemainingMs - actualElapsedMs);

    console.log(`[TimeManager] Session ended: ${sessionId} (${reason}) | World before: ${worldBefore}ms, Elapsed: ${actualElapsedMs}ms, World after: ${this.#worldRemainingMs}ms`);

    const result = {
      elapsedMs: actualElapsedMs,
      elapsedSec: Math.ceil(actualElapsedMs / 1000),
      worldRemainingMs: this.#worldRemainingMs,
      worldRemainingSec: Math.ceil(this.#worldRemainingMs / 1000),
    };

    this.#activeSession = null;
    this.save();
    return result;
  }

  /**
   * Live readout for minigame HUD:
   * Returns current minigame countdown & synchronized live overworld remaining
   * @returns {{ sessionRemainingSec: number, formattedSessionTime: string, liveWorldRemainingSec: number, formattedLiveWorldTime: string }}
   */
  getLiveReadout() {
    if (!this.#activeSession) {
      const worldSec = this.worldRemainingSec;
      return {
        sessionRemainingSec: 0,
        formattedSessionTime: '00:00',
        liveWorldRemainingSec: worldSec,
        formattedLiveWorldTime: this.formatTime(worldSec),
      };
    }

    const sessionLeftMs = Math.max(0, this.#activeSession.sessionLimitMs - this.#activeSession.elapsedMs);
    const sessionSec = Math.ceil(sessionLeftMs / 1000);

    const liveWorldLeftMs = Math.max(0, this.#worldRemainingMs - this.#activeSession.elapsedMs);
    const liveWorldSec = Math.ceil(liveWorldLeftMs / 1000);

    return {
      sessionRemainingSec: sessionSec,
      formattedSessionTime: this.formatTime(sessionSec),
      liveWorldRemainingSec: liveWorldSec,
      formattedLiveWorldTime: this.formatTime(liveWorldSec),
    };
  }

  /**
   * Formats seconds into MM:SS
   * @param {number} totalSeconds
   * @returns {string}
   */
  formatTime(totalSeconds) {
    const sec = Math.max(0, Math.ceil(totalSeconds));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Overworld formatted countdown
   * @returns {string}
   */
  getFormattedWorldTime() {
    return this.formatTime(this.worldRemainingSec);
  }
}

export const TimeManager = new TimeManagerClass();

