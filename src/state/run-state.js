import { TimeManager } from '../systems/time-manager.js';

const RUN_STATE_STORAGE_KEY = 'CHAIN_HEIST_RUN_STATE';

export const TOTAL_RUN_TIME_SECONDS = 420; // 7 minutes

export class RunStateManager {
  /** @type {string} */
  name;
  /** @type {string} */
  hunter;
  /** @type {number} */
  lives;
  /** @type {number} */
  score;
  /** @type {number[]} */
  cleared;
  /** @type {number} */
  tokensFound;
  /** @type {number[]} */
  collectedTokenIds;
  /** @type {number} */
  runStart;
  /** @type {number} */
  pausedTime;
  /** @type {number} */
  timeRemaining;
  /** @type {boolean} */
  isPaused;
  /** @type {boolean} */
  hasTimerStarted;
  /** @type {boolean} */
  reduceMotion;
  /** @type {number} */
  #pauseStartTimestamp = 0;

  constructor() {
    this.resetToDefaults();
  }

  resetToDefaults() {
    this.name = 'HUNTER_01';
    this.hunter = 'cat-1';
    this.lives = 3;
    this.score = 0;
    this.cleared = [];
    this.tokensFound = 0;
    this.collectedTokenIds = [];
    this.runStart = 0;
    this.pausedTime = 0;
    this.timeRemaining = TOTAL_RUN_TIME_SECONDS;
    this.isPaused = false;
    this.hasTimerStarted = false;
    this.reduceMotion = false;
    this.#pauseStartTimestamp = 0;
    TimeManager.reset(TOTAL_RUN_TIME_SECONDS);
  }

  /**
   * Initializes a brand new run with the chosen player credentials
   * @param {string} [name='HUNTER_01']
   * @param {string} [hunter='cat-1']
   */
  initNewRun(name = 'HUNTER_01', hunter = 'cat-1') {
    this.name = name;
    this.hunter = hunter;
    this.lives = 3;
    this.score = 0;
    this.cleared = [];
    this.tokensFound = 0;
    this.collectedTokenIds = [];
    this.runStart = Date.now();
    this.pausedTime = 0;
    this.timeRemaining = TOTAL_RUN_TIME_SECONDS;
    this.isPaused = false;
    this.hasTimerStarted = false;
    this.reduceMotion = false;
    this.#pauseStartTimestamp = 0;
    TimeManager.reset(TOTAL_RUN_TIME_SECONDS);
    this.save();
  }

  /**
   * Toggles reduce motion setting and persists it
   * @returns {boolean}
   */
  toggleReduceMotion() {
    this.reduceMotion = !this.reduceMotion;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('CHAIN_HEIST_REDUCE_MOTION', String(this.reduceMotion));
    }
    this.save();
    return this.reduceMotion;
  }

  /**
   * Starts the 7:00 countdown when the player first appears in the world
   */
  startTimer() {
    if (!this.hasTimerStarted) {
      this.hasTimerStarted = true;
      this.runStart = Date.now();
    }
    this.resumeTimer();
  }

  pauseTimer() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.#pauseStartTimestamp = Date.now();
      if (typeof TimeManager !== 'undefined') {
        TimeManager.pause();
      }
      this.save();
    }
  }

  resumeTimer() {
    if (this.isPaused) {
      if (this.#pauseStartTimestamp > 0) {
        this.pausedTime += (Date.now() - this.#pauseStartTimestamp);
        this.#pauseStartTimestamp = 0;
      }
      this.isPaused = false;
      if (typeof TimeManager !== 'undefined') {
        TimeManager.resume();
      }
      this.save();
    }
  }

  /**
   * Updates time remaining by deducting delta in seconds
   * @param {number} deltaSeconds
   * @returns {boolean} True if time has hit 0
   */
  tick(deltaSeconds) {
    if (!this.hasTimerStarted || this.isPaused) {
      return false;
    }

    if (typeof TimeManager !== 'undefined') {
      const status = TimeManager.tick(deltaSeconds * 1000);
      this.timeRemaining = TimeManager.worldRemainingSec;
      if (status.worldExpired || this.timeRemaining <= 0) {
        this.save();
        return true;
      }
      return false;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - deltaSeconds);
    if (this.timeRemaining <= 0) {
      this.save();
      return true; // time expired
    }
    return false;
  }

  /**
   * Formatted MM:SS string
   * @returns {string}
   */
  getFormattedTime() {
    if (typeof TimeManager !== 'undefined' && TimeManager.worldRemainingSec !== undefined) {
      return TimeManager.getFormattedWorldTime();
    }
    const totalSec = Math.ceil(this.timeRemaining);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /**
   * @param {number} points
   */
  addScore(points) {
    this.score += points;
    this.save();
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    this.save();
  }

  /**
   * @param {number} districtId
   */
  markDistrictCleared(districtId) {
    if (!this.cleared.includes(districtId)) {
      this.cleared.push(districtId);
      this.addScore(1000);
      this.save();
    }
  }

  /**
   * @param {number} tokenId
   */
  collectToken(tokenId) {
    if (!this.collectedTokenIds.includes(tokenId)) {
      this.collectedTokenIds.push(tokenId);
      this.tokensFound += 1;
      this.addScore(50);
      this.save();
    }
  }

  save() {
    if (typeof localStorage === 'undefined') return;
    try {
      let currentPausedTime = this.pausedTime;
      if (this.isPaused && this.#pauseStartTimestamp > 0) {
        currentPausedTime += (Date.now() - this.#pauseStartTimestamp);
      }
      const data = {
        name: this.name,
        hunter: this.hunter,
        lives: this.lives,
        score: this.score,
        cleared: this.cleared,
        tokensFound: this.tokensFound,
        collectedTokenIds: this.collectedTokenIds,
        runStart: this.runStart,
        pausedTime: currentPausedTime,
        timeRemaining: this.timeRemaining,
        isPaused: this.isPaused,
        hasTimerStarted: this.hasTimerStarted,
        reduceMotion: this.reduceMotion,
      };
      localStorage.setItem(RUN_STATE_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[RunState] Failed to save run state to localStorage', err);
    }
  }

  load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(RUN_STATE_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data) {
        this.name = data.name || this.name;
        this.hunter = data.hunter || this.hunter;
        this.lives = typeof data.lives === 'number' ? data.lives : 3;
        this.score = typeof data.score === 'number' ? data.score : 0;
        this.cleared = Array.isArray(data.cleared) ? data.cleared : [];
        this.tokensFound = typeof data.tokensFound === 'number' ? data.tokensFound : 0;
        this.collectedTokenIds = Array.isArray(data.collectedTokenIds) ? data.collectedTokenIds : [];
        this.runStart = data.runStart || 0;
        this.pausedTime = typeof data.pausedTime === 'number' ? data.pausedTime : 0;
        this.timeRemaining = typeof data.timeRemaining === 'number' ? data.timeRemaining : TOTAL_RUN_TIME_SECONDS;
        this.isPaused = Boolean(data.isPaused);
        this.hasTimerStarted = Boolean(data.hasTimerStarted);
        this.reduceMotion = Boolean(data.reduceMotion);
      }
      TimeManager.load();
      if (TimeManager.worldRemainingSec !== undefined) {
        this.timeRemaining = TimeManager.worldRemainingSec;
      }
    } catch (err) {
      console.warn('[RunState] Failed to load run state from localStorage', err);
    }
  }
}

export const runState = new RunStateManager();

/**
 * Checks whether Reduce Motion is active via OS preference or game setting
 * @returns {boolean}
 */
export function isReduceMotionActive() {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }
  if (runState && runState.reduceMotion) {
    return true;
  }
  if (typeof localStorage !== 'undefined' && localStorage.getItem('CHAIN_HEIST_REDUCE_MOTION') === 'true') {
    return true;
  }
  return false;
}
