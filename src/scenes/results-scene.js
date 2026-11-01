import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { runState } from '../state/run-state.js';
import { dataManager } from '../utils/data-manager.js';
import { ScoreManager } from '../systems/score-manager.js';
import { leaderboard } from '../systems/leaderboard.js';
import { MAX_DISTRICTS } from '../config.js';

export class ResultsScene extends BaseScene {
  /** @type {boolean} */
  #isConfirmed = false;
  /** @type {boolean} */
  #isVictory = false;
  /** @type {number} */
  #baseScore = 0;
  /** @type {number} */
  #finalScore = 0;
  /** @type {number} */
  #displayedScore = 0;
  /** @type {string} */
  #badge = 'NONE';
  /** @type {string} */
  #runCode = '#0000-0000';
  /** @type {Phaser.GameObjects.Text | undefined} */
  #scoreText;
  /** @type {Array<{ container: Phaser.GameObjects.Container, baseAngle: number }>} */
  #orbitBadges = [];
  /** @type {Phaser.GameObjects.Image | undefined} */
  #catSprite;

  constructor() {
    super({
      key: SCENE_KEYS.RESULTS_SCENE,
    });
  }

  create() {
    super.create();
    this.#isConfirmed = false;
    this.#orbitBadges = [];

    this.cameras.main.setBackgroundColor('#060412');
    this.cameras.main.fadeIn(500);

    // Compute canonical score breakdown via ScoreManager
    const breakdown = ScoreManager.computeFinalBreakdown();
    this.#isVictory = breakdown.isVictory;
    this.#baseScore = breakdown.baseScore;
    this.#finalScore = breakdown.finalScore;
    this.#displayedScore = this.#baseScore;
    this.#badge = breakdown.badge;
    this.#runCode = breakdown.verificationCode;

    const timeLeft = breakdown.timeLeft;
    const livesLeft = breakdown.livesLeft;
    const timeBonus = breakdown.timeBonus;
    const lifeBonus = breakdown.lifeBonus;

    // Submit to persistent unified leaderboard
    this.#saveToLeaderboard(timeLeft);

    // Decorative grid background
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1b1435, 0.4);
    for (let x = 0; x < this.scale.width; x += 32) {
      grid.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 32) {
      grid.lineBetween(0, y, this.scale.width, y);
    }

    // Top Header Banner
    const bannerBorderCol = this.#isVictory ? 0x00FF66 : 0xFF2A6D;
    const bannerHeaderCol = this.#isVictory ? '#00FF66' : '#FF2A6D';
    const bannerHeaderText = this.#isVictory ? 'NETWORK SECURED!' : 'GAME OVER';
    const bannerSubtext = this.#isVictory
      ? `ALL ${MAX_DISTRICTS} DISTRICT CONSENSUS NODES DEFENDED · OVERRIDE PREVENTED`
      : (breakdown.gameOverReason || 'OPERATION TERMINATED · DISTRICT INTEGRITY COMPROMISED');

    const headerBox = this.add.rectangle(this.scale.width / 2, 54, 860, 64, 0x0a061c, 0.95)
      .setStrokeStyle(2, bannerBorderCol, 1);

    this.add.text(this.scale.width / 2, 42, bannerHeaderText, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '28px',
      color: bannerHeaderCol,
      fontStyle: 'bold',
      stroke: '#04020a',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, 68, bannerSubtext, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // LEFT: Pedestal & Cat with spinning badges
    this.#createPedestalAndCat();

    // RIGHT: Results Card & Score Breakdown
    this.#createResultsCard(timeBonus, lifeBonus, timeLeft, livesLeft);

    // Score Counting Up Animation (if victory and bonus added)
    if (this.#finalScore > this.#baseScore) {
      this.tweens.addCounter({
        from: this.#baseScore,
        to: this.#finalScore,
        duration: 1200,
        ease: 'Power1',
        onUpdate: (tween) => {
          this.#displayedScore = Math.floor(tween.getValue());
          if (this.#scoreText) {
            this.#scoreText.setText(String(this.#displayedScore).padStart(6, '0'));
          }
        },
      });
    }

    // Bottom Action Prompt
    const actionBtn = this.add.rectangle(this.scale.width / 2, 535, 420, 42, 0x140e32, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 1)
      .setInteractive({ useHandCursor: true });

    const actionText = this.add.text(this.scale.width / 2, 535, 'VIEW THE LEDGER  ▶  [SPACE / ENTER]', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    actionBtn.on('pointerdown', () => this.#goToLeaderboard());

    this.tweens.add({
      targets: actionText,
      alpha: { from: 0.8, to: 1.0 },
      scale: { from: 0.98, to: 1.02 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(time) {
    super.update();

    // Orbit spinning badges around pedestal if victory
    if (this.#isVictory && this.#orbitBadges.length > 0) {
      const pedX = 230;
      const pedY = 320;
      const radiusX = 85;
      const radiusY = 28;
      const speed = 0.0018;

      this.#orbitBadges.forEach((b) => {
        const currentAngle = b.baseAngle + time * speed;
        const x = pedX + Math.cos(currentAngle) * radiusX;
        const y = pedY + Math.sin(currentAngle) * radiusY;

        b.container.setPosition(x, y);

        // Dynamic depth sorting so front passes over cat, back passes behind
        if (Math.sin(currentAngle) > 0) {
          b.container.setDepth(20);
        } else {
          b.container.setDepth(5);
        }
      });
    }

    // Input handlers
    if (!this.#isConfirmed) {
      if (this._controls.wasSpaceKeyPressed() || this._controls.wasEnterKeyPressed()) {
        this.#goToLeaderboard();
      }
    }
  }

  /**
   * Builds the left pedestal with chosen Cat sprite and glowing orbiting badges
   * @returns {void}
   */
  #createPedestalAndCat() {
    const pedX = 230;
    const pedY = 340;

    // Pedestal glow
    const pedGlow = this.add.ellipse(pedX, pedY + 12, 180, 52, this.#isVictory ? 0x00FF66 : 0xFF3366, 0.22);
    this.tweens.add({
      targets: pedGlow,
      alpha: { from: 0.16, to: 0.32 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 3-tiered cyber platform
    const baseEllipse = this.add.ellipse(pedX, pedY + 12, 168, 44, 0x0a0522, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 0.7);

    const midEllipse = this.add.ellipse(pedX, pedY, 138, 36, 0x140c3c, 0.95)
      .setStrokeStyle(2, this.#isVictory ? 0x00FF66 : 0xFF3366, 1);

    const topEllipse = this.add.ellipse(pedX, pedY - 10, 106, 28, 0x1e1254, 0.95)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.8);

    // Pedestal text badge
    const pedLabel = this.add.text(pedX, pedY + 14, this.#isVictory ? 'NODE SECURED' : 'SYSTEM HALT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '10px',
      color: this.#isVictory ? '#00FF66' : '#FF2A6D',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Chosen Cat on pedestal
    const catAssetKey = dataManager.getPlayerCat() || runState.hunter || 'cat-1';
    this.#catSprite = this.add.image(pedX, pedY - 10, catAssetKey)
      .setOrigin(0.5, 1.0)
      .setScale(0.5) // ~69px tall
      .setDepth(15);

    if (this.#catSprite.texture) {
      this.#catSprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    if (this.#isVictory) {
      // Gentle idle breathing
      this.tweens.add({
        targets: this.#catSprite,
        y: pedY - 13,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // 4 Spinning Badges for all 4 districts
      const badgeData = [
        { label: 'BLOCK', color: 0x00E5FF, colorHex: '#00E5FF', symbol: '■' },
        { label: 'VAULT', color: 0xFFD700, colorHex: '#FFD700', symbol: '★' },
        { label: 'CHAIN', color: 0x00FF66, colorHex: '#00FF66', symbol: '◆' },
        { label: 'HEIST', color: 0xFF007F, colorHex: '#FF007F', symbol: '⛓' },
      ];

      badgeData.forEach((b, idx) => {
        const badgeCont = this.add.container(0, 0);

        // Glowing outer circle
        const bgCircle = this.add.circle(0, 0, 14, 0x070414, 0.95)
          .setStrokeStyle(2, b.color, 1);

        const symText = this.add.text(0, -1, b.symbol, {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '13px',
          color: b.colorHex,
          fontStyle: 'bold',
        }).setOrigin(0.5);

        const bTag = this.add.text(0, 17, b.label, {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '9px',
          color: b.colorHex,
          fontStyle: 'bold',
          stroke: '#050210',
          strokeThickness: 2,
        }).setOrigin(0.5);

        badgeCont.add([bgCircle, symText, bTag]);

        this.#orbitBadges.push({
          container: badgeCont,
          baseAngle: (idx * Math.PI * 2) / badgeData.length,
        });
      });
    } else {
      // Defeated tint
      this.#catSprite.setTint(0xFF3366).setAlpha(0.65);
    }
  }

  /**
   * Builds the results breakdown card on the right
   * @param {number | string} timeBonus
   * @param {number | string} lifeBonus
   * @param {number} timeLeft
   * @param {number} livesLeft
   * @returns {void}
   */
  #createResultsCard(timeBonus, lifeBonus, timeLeft, livesLeft) {
    const cardX = 660;
    const cardY = 300;
    const cardW = 540;
    const cardH = 370;

    // Card frame
    const cardBg = this.add.rectangle(cardX, cardY, cardW, cardH, 0x09061c, 0.96)
      .setStrokeStyle(2, 0x3FF0FF, 0.9);

    const cornerDecor = this.add.graphics();
    cornerDecor.lineStyle(1.5, this.#isVictory ? 0x00FF66 : 0xFF2A6D, 0.6);
    cornerDecor.strokeRect(cardX - cardW / 2 + 4, cardY - cardH / 2 + 4, cardW - 8, cardH - 8);

    // Final Score title
    this.add.text(cardX, cardY - 145, 'FINAL PROTOCOL SCORE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Large Gold Score Text
    const initialScoreStr = String(this.#displayedScore).padStart(6, '0');
    this.#scoreText = this.add.text(cardX, cardY - 110, initialScoreStr, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '44px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#06020c',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Divider
    const div1 = this.add.graphics();
    div1.lineStyle(1, 0x3FF0FF, 0.35);
    div1.lineBetween(cardX - 230, cardY - 75, cardX + 230, cardY - 75);

    // Breakdown Stats Rows
    const rows = [
      { label: 'BASE MISSION SCORE', value: `${this.#baseScore}` },
      { label: `TIME BONUS (+10/s · ${timeLeft}s LEFT)`, value: this.#isVictory ? `+${timeBonus}` : 'n/a' },
      { label: `LIFE BONUS (+300/♥ · ${livesLeft} LEFT)`, value: this.#isVictory ? `+${lifeBonus}` : 'n/a' },
      { label: 'DISTRICTS CLEARED', value: `${runState.cleared.length} / ${MAX_DISTRICTS}` },
      { label: 'HIDDEN TOKENS FOUND', value: `${runState.tokensFound} / 10` },
    ];

    rows.forEach((r, idx) => {
      const ry = cardY - 52 + idx * 23;
      this.add.text(cardX - 220, ry, r.label, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: '#A8A4C4',
      }).setOrigin(0, 0.5);

      this.add.text(cardX + 220, ry, r.value, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '13px',
        color: '#3FF0FF',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    });

    // Divider 2
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x3FF0FF, 0.35);
    div2.lineBetween(cardX - 230, cardY + 70, cardX + 230, cardY + 70);

    // Badge Display Pill
    const badgeColors = {
      GOLD: { bg: 0x332605, border: 0xFFD700, text: '#FFD700', icon: '★ GOLD BADGE' },
      SILVER: { bg: 0x1f242d, border: 0xD9E2EC, text: '#D9E2EC', icon: '★ SILVER BADGE' },
      BRONZE: { bg: 0x2b1c13, border: 0xCD7F32, text: '#CD7F32', icon: '★ BRONZE BADGE' },
      NONE: { bg: 0x15121e, border: 0x555566, text: '#777292', icon: '— NO BADGE EARNED' },
    };
    const bInfo = badgeColors[this.#badge] || badgeColors.NONE;

    const badgePill = this.add.rectangle(cardX - 115, cardY + 115, 205, 40, bInfo.bg, 0.95)
      .setStrokeStyle(2, bInfo.border, 1);

    this.add.text(cardX - 115, cardY + 115, bInfo.icon, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: bInfo.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Run Verification Short Code Pill
    const codeBox = this.add.rectangle(cardX + 115, cardY + 115, 205, 40, 0x0c0822, 0.95)
      .setStrokeStyle(1.5, 0x00E5FF, 0.8);

    this.add.text(cardX + 115, cardY + 106, 'RUN VERIFICATION', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '9px',
      color: '#8E8AAB',
    }).setOrigin(0.5);

    this.add.text(cardX + 115, cardY + 124, this.#runCode, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#00FFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  /**
   * Persists run results into leaderboard service
   * @param {number} timeLeft
   * @returns {Promise<void>}
   */
  async #saveToLeaderboard(timeLeft) {
    const entry = {
      name: runState.name || 'ANON_HUNTER',
      hunter: runState.hunter || 'cat-1',
      score: this.#finalScore,
      districts: runState.cleared.length,
      tokens: runState.tokensFound,
      badge: this.#badge,
      timestamp: Date.now(),
      verificationCode: this.#runCode,
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('CHAIN_HEIST_LAST_RUN_CODE', this.#runCode);
      } catch {}
    }

    try {
      await leaderboard.submitScore(entry);
    } catch (err) {
      console.warn('[ResultsScene] Failed to submit score to leaderboard:', err);
    }
  }

  /**
   * Transitions to Leaderboard scene
   * @returns {void}
   */
  #goToLeaderboard() {
    this.#isConfirmed = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.LEADERBOARD_SCENE);
    });
  }
}
