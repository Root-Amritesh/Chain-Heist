// @ts-nocheck
export const INITIAL_LIVES = 3;

/**
 * LivesManager - Single source of truth for player lives (hearts) in Chain Heist 2099.
 *
 * Requirements:
 * 1. Initialized to 3 once per run (not per scene).
 * 2. API: getLives(), loseLife({reason, deathId}), onChange(cb), onGameOver(cb), reset(count).
 * 3. Idempotent per deathId: same deathId never subtracts twice; different deathIds always subtract.
 * 4. At 0 lives: triggers Game Over exactly once (double Game Over guard).
 * 5. Survives scene switches, minigame restarts, dialog open/close, tab hide/show.
 * 6. Resets to 3 only on brand new run start.
 */
class LivesManagerClass {
  /** @type {number} */
  #lives = INITIAL_LIVES;

  /** @type {number} */
  #deathIndex = 0;

  /** @type {Set<string>} */
  #processedDeathIds = new Set();

  /** @type {Set<Function>} */
  #listeners = new Set();

  /** @type {boolean} */
  #gameOverTriggered = false;

  /** @type {Set<Function>} */
  #gameOverListeners = new Set();

  /** @type {any} */
  #runStateRef = null;

  constructor() {
    this.reset(INITIAL_LIVES);
  }

  /**
   * Connects the RunStateManager instance to keep persistence synced
   * @param {any} runState
   */
  attachRunState(runState) {
    this.#runStateRef = runState;
  }

  /**
   * Returns current remaining lives (0..3)
   * @returns {number}
   */
  getLives() {
    return this.#lives;
  }

  /**
   * Whether lives have been completely exhausted
   * @returns {boolean}
   */
  isGameOver() {
    return this.#lives <= 0;
  }

  /**
   * Generates a unique, monotonically incrementing death ID for the current run.
   * Format: `${runId}:${deathIndex}`
   * @returns {string}
   */
  createDeathId() {
    this.#deathIndex += 1;
    const runId = this.#runStateRef?.runStart || 'run';
    return `${runId}:${this.#deathIndex}`;
  }

  /**
   * Deducts one life idempotently.
   * If deathId has already been processed, it is ignored and current lives count is returned.
   * If deathId is not provided, one is generated automatically.
   *
   * @param {{ reason?: string, deathId?: string }} [options]
   * @returns {number} New lives count
   */
  loseLife({ reason = 'unknown', deathId = null } = {}) {
    const id = deathId || this.createDeathId();

    // Idempotency check: if this specific death was already processed, ignore
    if (this.#processedDeathIds.has(id)) {
      console.warn(`[LivesManager] Duplicate deathId ignored: ${id}`);
      return this.#lives;
    }
    this.#processedDeathIds.add(id);

    if (this.#lives > 0) {
      this.#lives = Math.max(0, this.#lives - 1);

      // Keep runState in sync for persistence
      if (this.#runStateRef) {
        this.#runStateRef.lives = this.#lives;
        if (typeof this.#runStateRef.save === 'function') {
          this.#runStateRef.save();
        }
      }

      console.log(`[LivesManager] Life lost (${reason}, deathId: ${id}). Remaining lives: ${this.#lives}`);

      // Notify all change listeners
      this.#notifyChange({ reason, deathId: id, lives: this.#lives });

      // If lives reached 0, fire Game Over event exactly once
      if (this.#lives <= 0 && !this.#gameOverTriggered) {
        this.#gameOverTriggered = true;
        console.warn(`[LivesManager] Operative exhausted all lives. Triggering Game Over.`);
        this.#notifyGameOver({ reason, deathId: id });
      }
    }

    return this.#lives;
  }

  /**
   * Registers a callback invoked whenever lives change.
   * @param {(lives: number, event: { reason: string, deathId: string, lives: number }) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  onChange(callback) {
    if (typeof callback !== 'function') return () => {};
    this.#listeners.add(callback);
    return () => {
      this.#listeners.delete(callback);
    };
  }

  /**
   * Registers a callback invoked once when lives reach 0.
   * @param {(event: { reason: string, deathId: string }) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  onGameOver(callback) {
    if (typeof callback !== 'function') return () => {};
    this.#gameOverListeners.add(callback);
    return () => {
      this.#gameOverListeners.delete(callback);
    };
  }

  /**
   * Resets lives system for a brand new run.
   * @param {number} [count=INITIAL_LIVES]
   */
  reset(count = INITIAL_LIVES) {
    this.#lives = Math.max(0, Math.min(INITIAL_LIVES, count));
    this.#deathIndex = 0;
    this.#processedDeathIds.clear();
    this.#gameOverTriggered = false;

    if (this.#runStateRef) {
      this.#runStateRef.lives = this.#lives;
    }

    this.#notifyChange({ reason: 'reset', deathId: 'init', lives: this.#lives });
  }

  /**
   * Restores lives from persisted runState/localStorage
   * @param {number} [storedLives]
   */
  load(storedLives) {
    const livesToLoad = typeof storedLives === 'number' 
      ? storedLives 
      : (this.#runStateRef && typeof this.#runStateRef.lives === 'number' ? this.#runStateRef.lives : INITIAL_LIVES);

    this.#lives = Math.max(0, Math.min(INITIAL_LIVES, livesToLoad));
    if (this.#lives <= 0) {
      this.#gameOverTriggered = true;
    }
  }

  #notifyChange(event) {
    for (const listener of this.#listeners) {
      try {
        listener(this.#lives, event);
      } catch (err) {
        console.error('[LivesManager] Listener error:', err);
      }
    }
  }

  #notifyGameOver(event) {
    for (const listener of this.#gameOverListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[LivesManager] GameOver listener error:', err);
      }
    }
  }
}

export const LivesManager = new LivesManagerClass();

