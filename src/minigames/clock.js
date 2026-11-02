/**
 * MiniGameClock - Monotonic shared clock for minigames
 * Driven by performance.now() deltas, independent of Phaser frame deltas.
 * Automatically handles tab visibility (pausing when hidden).
 * Emits 'expired' exactly once.
 */

export class MiniGameClock {
  /** @type {number} Total initial duration in milliseconds */
  #initialDurationMs = 90000;

  /** @type {number} Remaining time in milliseconds */
  #remainingMs = 90000;

  /** @type {number} Elapsed time in milliseconds */
  #elapsedMs = 0;

  /** @type {number | null} Timestamp of last update via performance.now() */
  #lastTime = null;

  /** @type {boolean} */
  #isRunning = false;

  /** @type {boolean} */
  #isPaused = false;

  /** @type {boolean} */
  #isPausedByVisibility = false;

  /** @type {boolean} */
  #hasExpired = false;

  /** @type {number | null} Interval ID for 10Hz tick */
  #tickIntervalId = null;

  /** @type {Set<(remainingMs: number) => void>} */
  #tickListeners = new Set();

  /** @type {Set<() => void>} */
  #expiredListeners = new Set();

  /** @type {((e: Event) => void) | null} */
  #visibilityHandler = null;

  /**
   * @param {number} [durationMs=90000] Initial timer duration in ms (default 90s)
   */
  constructor(durationMs = 90000) {
    this.#initialDurationMs = durationMs;
    this.#remainingMs = durationMs;

    this.#visibilityHandler = () => {
      if (document.hidden) {
        if (this.#isRunning && !this.#isPaused) {
          this.#isPausedByVisibility = true;
          this.pause();
        }
      } else {
        if (this.#isPausedByVisibility) {
          this.#isPausedByVisibility = false;
          this.resume();
        }
      }
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.#visibilityHandler);
    }
  }

  /**
   * Starts the clock with an optional duration (in ms) and optional start timestamp.
   * @param {number} [durationMs]
   * @param {number} [startTime]
   */
  start(durationMs, startTime) {
    if (typeof durationMs === 'number' && durationMs > 0) {
      this.#initialDurationMs = durationMs;
      this.#remainingMs = durationMs;
    }
    this.#elapsedMs = 0;
    this.#hasExpired = false;
    this.#isRunning = true;
    this.#isPaused = false;
    this.#isPausedByVisibility = false;
    this.#lastTime = (typeof startTime === 'number')
      ? startTime
      : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());

    this.#startTickInterval();
  }

  /**
   * Updates clock with monotonic delta. Can be called on frame or via interval.
   * @param {number} [now] Optional current timestamp from performance.now()
   * @returns {number} Remaining ms
   */
  update(now) {
    if (!this.#isRunning || this.#isPaused || this.#hasExpired) {
      return this.#remainingMs;
    }

    const currentTime = (typeof now === 'number')
      ? now
      : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());

    if (this.#lastTime === null) {
      this.#lastTime = currentTime;
      return this.#remainingMs;
    }

    const delta = Math.max(0, currentTime - this.#lastTime);
    this.#lastTime = currentTime;

    if (delta > 0) {
      this.#remainingMs = Math.max(0, this.#remainingMs - delta);
      this.#elapsedMs += delta;

      if (this.#remainingMs <= 0 && !this.#hasExpired) {
        this.#hasExpired = true;
        this.#remainingMs = 0;
        this.#isRunning = false;
        this.#stopTickInterval();
        this.#fireExpired();
      }
    }

    return this.#remainingMs;
  }

  /**
   * Explicitly pause the clock.
   * @param {number} [pauseTime]
   */
  pause(pauseTime) {
    if (!this.#isRunning || this.#isPaused) return;
    this.update(pauseTime); // Flush elapsed time before pausing
    this.#isPaused = true;
    this.#lastTime = null;
    this.#stopTickInterval();
  }

  /**
   * Explicitly resume the clock.
   * @param {number} [resumeTime]
   */
  resume(resumeTime) {
    if (!this.#isRunning || !this.#isPaused) return;
    this.#isPaused = false;
    this.#lastTime = (typeof resumeTime === 'number')
      ? resumeTime
      : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
    this.#startTickInterval();
  }

  /**
   * Stops the clock without triggering 'expired'.
   */
  stop() {
    this.#isRunning = false;
    this.#isPaused = false;
    this.#lastTime = null;
    this.#stopTickInterval();
  }

  /**
   * Resets clock to initial duration.
   * @param {number} [durationMs]
   */
  reset(durationMs) {
    this.stop();
    if (typeof durationMs === 'number' && durationMs > 0) {
      this.#initialDurationMs = durationMs;
    }
    this.#remainingMs = this.#initialDurationMs;
    this.#elapsedMs = 0;
    this.#hasExpired = false;
  }

  /**
   * Adds a time adjustment (e.g. bonus shard +5000ms or penalty -3000ms).
   * @param {number} deltaMs
   */
  addTime(deltaMs) {
    if (this.#hasExpired) return;
    this.#remainingMs = Math.max(0, this.#remainingMs + deltaMs);
    if (this.#remainingMs <= 0 && !this.#hasExpired) {
      this.#hasExpired = true;
      this.#remainingMs = 0;
      this.#isRunning = false;
      this.#stopTickInterval();
      this.#fireExpired();
    }
  }

  /**
   * Subscribe to events ('expired' or 'tick').
   * @param {'expired' | 'tick'} event
   * @param {Function} callback
   * @returns {() => void}
   */
  on(event, callback) {
    if (event === 'expired') {
      return this.onExpired(callback);
    }
    if (event === 'tick') {
      return this.onTick(callback);
    }
    return () => {};
  }

  /**
   * Subscribe to 10Hz ticks or update events.
   * @param {(remainingMs: number) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  onTick(callback) {
    this.#tickListeners.add(callback);
    return () => this.#tickListeners.delete(callback);
  }

  /**
   * Subscribe to 'expired' event (fires EXACTLY ONCE).
   * @param {() => void} callback
   * @returns {() => void} Unsubscribe function
   */
  onExpired(callback) {
    this.#expiredListeners.add(callback);
    return () => this.#expiredListeners.delete(callback);
  }

  #fireExpired() {
    const listeners = Array.from(this.#expiredListeners);
    for (const listener of listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[MiniGameClock] Error in expired listener:', err);
      }
    }
  }

  #startTickInterval() {
    this.#stopTickInterval();
    // 10Hz tick (100ms) for background polling and reactive subscriber updates
    this.#tickIntervalId = (typeof setInterval !== 'undefined')
      ? setInterval(() => {
          if (this.#isRunning && !this.#isPaused && !this.#hasExpired) {
            this.update();
            for (const cb of this.#tickListeners) {
              cb(this.#remainingMs);
            }
          }
        }, 100)
      : null;
  }

  #stopTickInterval() {
    if (this.#tickIntervalId !== null) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
  }

  /**
   * Getter: Remaining time in milliseconds (clamped to >= 0)
   */
  get remaining() {
    return Math.max(0, this.#remainingMs);
  }

  /**
   * Getter: Remaining time in seconds (ceiling)
   */
  get remainingSec() {
    return Math.max(0, Math.ceil(this.remaining / 1000));
  }

  /**
   * Getter: Elapsed time in milliseconds
   */
  get elapsed() {
    return this.#elapsedMs;
  }

  /**
   * Getter: Formatted time string MM:SS
   */
  get formatted() {
    const totalSec = this.remainingSec;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Getter: isRunning
   */
  get isRunning() {
    return this.#isRunning;
  }

  /**
   * Getter: isPaused
   */
  get isPaused() {
    return this.#isPaused;
  }

  /**
   * Getter: hasExpired
   */
  get hasExpired() {
    return this.#hasExpired;
  }

  /**
   * Fully destroys the clock, detaches listeners and clears intervals.
   */
  destroy() {
    this.stop();
    if (this.#visibilityHandler && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.#visibilityHandler);
      this.#visibilityHandler = null;
    }
    this.#tickListeners.clear();
    this.#expiredListeners.clear();
  }
}
