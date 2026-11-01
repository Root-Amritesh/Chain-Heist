import {
  COIN_VALUE,
  TOKEN_VALUE,
  DISTRICT_CLEAR_BONUS,
  TIME_BONUS_PER_SECOND,
  LIFE_BONUS_PER_HEART,
  PARTICIPATION_BONUS,
  MAX_DISTRICTS,
  MAX_POSSIBLE_SCORE,
} from '../config.js';
import { runState } from '../state/run-state.js';

export class ScoreManager {
  /** @type {Set<string>} */
  static #reportedResults = new Set();

  /**
   * Returns current config constants
   */
  static getConfig() {
    return {
      COIN_VALUE,
      TOKEN_VALUE,
      DISTRICT_CLEAR_BONUS,
      TIME_BONUS_PER_SECOND,
      LIFE_BONUS_PER_HEART,
      PARTICIPATION_BONUS,
      MAX_DISTRICTS,
      MAX_POSSIBLE_SCORE,
    };
  }

  /**
   * Adds score for collected coin
   * @returns {number} Current score
   */
  static addCoin() {
    runState.addScore(COIN_VALUE);
    return runState.score;
  }

  /**
   * Adds score and records collected token
   * @param {number} tokenId
   * @returns {number} Current score
   */
  static addToken(tokenId) {
    if (!runState.collectedTokenIds.includes(tokenId)) {
      runState.collectedTokenIds.push(tokenId);
      runState.tokensFound = runState.collectedTokenIds.length;
      runState.addScore(TOKEN_VALUE);
      runState.save();
    }
    return runState.score;
  }

  /**
   * Reports minigame completion idempotently
   * @param {string} gameId
   * @param {{ score?: number, completed?: boolean, durationMs?: number, runId?: string | number, portalId?: number | null }} [result]
   * @returns {{ success: boolean, duplicate?: boolean, earned?: number, score: number, completed: boolean }}
   */
  static reportGameResult(gameId, { score = 0, completed = false, durationMs = 0, runId = '', portalId = null } = { completed: false }) {
    const runKey = `${runId || runState.runStart || 'current'}_${gameId}`;
    if (this.#reportedResults.has(runKey)) {
      console.warn(`[ScoreManager] Result already reported for ${runKey}, ignoring duplicate call.`);
      return { success: false, duplicate: true, score: runState.score, completed };
    }
    this.#reportedResults.add(runKey);

    if (completed) {
      const earned = Math.max(0, score) + DISTRICT_CLEAR_BONUS;
      runState.addScore(earned);
      if (portalId !== null && portalId !== undefined) {
        if (!runState.cleared.includes(portalId)) {
          runState.cleared.push(portalId);
        }
      }
      runState.save();
      return { success: true, earned, score: runState.score, completed: true };
    } else {
      runState.loseLife();
      runState.save();
      return { success: true, earned: 0, score: runState.score, completed: false };
    }
  }

  /**
   * Computes the final score breakdown with strict validation
   */
  static computeFinalBreakdown() {
    runState.load();
    const baseScore = runState.score;
    const timeLeft = Math.max(0, Math.floor(runState.timeRemaining));
    const livesLeft = Math.max(0, runState.lives);
    const isVictory = runState.cleared.length >= MAX_DISTRICTS;

    let gameOverReason = null;
    if (!isVictory) {
      if (livesLeft <= 0) {
        gameOverReason = 'OPERATIVE TERMINATED · INSUFFICIENT LIVES';
      } else if (timeLeft <= 0) {
        gameOverReason = 'OPERATION ABORTED · TIME EXPIRED';
      } else {
        gameOverReason = 'DISTRICT INTEGRITY COMPROMISED';
      }
    }

    /** @type {number | string} */
    let timeBonus = 0;
    /** @type {number | string} */
    let lifeBonus = 0;
    let finalScore = baseScore;

    if (isVictory) {
      timeBonus = timeLeft * TIME_BONUS_PER_SECOND;
      lifeBonus = livesLeft * LIFE_BONUS_PER_HEART;
      finalScore = baseScore + timeBonus + lifeBonus;

      // Runtime equality check
      if (baseScore + timeBonus + lifeBonus !== finalScore) {
        console.error('[ScoreManager] Final victory score does not equal base + bonuses!', {
          baseScore,
          timeBonus,
          lifeBonus,
          finalScore,
        });
      }
    } else {
      // Rule: If bonus does not apply on loss, show "n/a" instead of +0
      timeBonus = 'n/a';
      lifeBonus = 'n/a';
      finalScore = baseScore;

      if (baseScore !== finalScore) {
        console.error('[ScoreManager] Final loss score does not equal base score!', {
          baseScore,
          finalScore,
        });
      }
    }

    finalScore = Math.min(finalScore, MAX_POSSIBLE_SCORE);

    let badge = 'NONE';
    if (isVictory) {
      if (finalScore >= 6500) badge = 'GOLD';
      else if (finalScore >= 4000) badge = 'SILVER';
      else badge = 'BRONZE';
    }

    const verificationCode = this.generateVerificationCode(runState.name, finalScore, runState.runStart);

    return {
      baseScore,
      timeLeft,
      timeBonus,
      livesLeft,
      lifeBonus,
      finalScore,
      isVictory,
      gameOverReason,
      verificationCode,
      badge,
      districtsCleared: runState.cleared.length,
      maxDistricts: MAX_DISTRICTS,
      tokensFound: runState.tokensFound,
      maxTokens: 10,
    };
  }

  /**
   * Deterministic verification code generator
   * @param {string} name
   * @param {number} finalScore
   * @param {number} [timestamp=0]
   * @param {number} [runSeed=1337]
   * @returns {string} Formatted hash code e.g. #A7F3-91C2
   */
  static generateVerificationCode(name, finalScore, timestamp = 0, runSeed = 1337) {
    const str = `${(name || 'HUNTER').trim().toUpperCase()}_${finalScore}_${timestamp}_${runSeed}`;
    let h1 = 0xdeadbeef ^ runSeed;
    let h2 = 0x41c64e6d ^ (runSeed << 5);
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    const p1 = ((h1 ^ (h1 >>> 16)) >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
    const p2 = ((h2 ^ (h2 >>> 16)) >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
    return `#${p1}-${p2}`;
  }

  /**
   * Reset run tracking
   */
  static clearRun() {
    this.#reportedResults.clear();
    runState.resetToDefaults();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('CHAIN_HEIST_RUN_STATE');
    }
  }
}

