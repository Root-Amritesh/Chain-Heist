import Phaser from '../../lib/phaser.js';
import { BaseScene } from '../base-scene.js';
import { SCENE_KEYS } from '../scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../../assets/font-keys.js';
import { dataManager } from '../../utils/data-manager.js';
import { runState, isReduceMotionActive } from '../../state/run-state.js';
import { TimeManager, SESSION_END_REASONS } from '../../systems/time-manager.js';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;
const CEILING_Y = 56;
const FLOOR_Y = 506;
const GAP_HEIGHT = 155;
const PILLAR_WIDTH = 58;
const PILLAR_SPACING = 300;
const WIN_PILLARS = 20;

export class BlockFlyerScene extends BaseScene {
  /** @type {object} */
  _data = {};

  // Player state
  /** @type {{x: number, y: number, vy: number, gravity: number, flapStrength: number, width: number, height: number}} */
  #player = {
    x: 200,
    y: 280,
    vy: 0,
    gravity: 0.30,
    flapStrength: -5.8,
    width: 30,
    height: 24,
  };

  /** @type {Phaser.GameObjects.Image} */
  #catSprite;

  /** @type {Phaser.GameObjects.Graphics} */
  #trailGraphics;

  /** @type {Array<{x: number, y: number, alpha: number, color: number}>} */
  #trailPoints = [];

  /** @type {Array<{x: number, y: number}>} */
  #ribbonHistory = [];

  /** @type {Array<{x: number, y: number, vx: number, vy: number, alpha: number, size: number, color: number}>} */
  #btcParticles = [];

  // Parallax layers
  /** @type {Array<Phaser.GameObjects.Image>} */
  #cityChunks = [];

  /** @type {Array<Phaser.GameObjects.Image>} */
  #groundStrips = [];

  /** @type {number} */
  #cityScrollX = 0;

  /** @type {number} */
  #groundScrollX = 0;

  // Obstacles & Pickups
  /** @type {Array<{
   *   id: number,
   *   x: number,
   *   gapY: number,
   *   gapHeight: number,
   *   passed: boolean,
   *   topSprite: Phaser.GameObjects.Image,
   *   bottomSprite: Phaser.GameObjects.Image,
   *   coin: Phaser.GameObjects.Image | null,
   *   coinCollected: boolean,
   *   drone: Phaser.GameObjects.Image | null,
   *   droneBaseY: number
   * }>} */
  #pillars = [];

  /** @type {number} */
  #nextPillarId = 0;

  /** @type {number} */
  #scrollSpeed = 2.4;

  /** @type {number} */
  #pillarsPassed = 0;

  /** @type {number} */
  #miniScore = 0;

  // Game flow states
  /** @type {boolean} */
  #isPlaying = false;

  /** @type {boolean} */
  #isGameOver = false;

  /** @type {boolean} */
  #hasWon = false;

  // HUD elements
  /** @type {Phaser.GameObjects.Text} */
  #pillarsText;

  /** @type {Phaser.GameObjects.Graphics} */
  #pillarsBarGraphics;

  /** @type {Phaser.GameObjects.Text} */
  #scoreText;

  /** @type {Phaser.GameObjects.Text} */
  #timerText;

  /** @type {Phaser.GameObjects.Text} */
  #worldTimerText;

  /** @type {string | null} */
  #sessionId = null;

  constructor() {
    super({ key: SCENE_KEYS.BLOCK_FLYER_SCENE });
  }

  init(data) {
    super.init(data);
    this._data = data || {};
    this.#player = {
      x: 200,
      y: 280,
      vy: 0,
      gravity: 0.30,
      flapStrength: -5.8,
      width: 30,
      height: 24,
    };
    this.#trailPoints = [];
    this.#cityChunks = [];
    this.#groundStrips = [];
    this.#cityScrollX = 0;
    this.#groundScrollX = 0;
    this.#pillars = [];
    this.#nextPillarId = 0;
    this.#scrollSpeed = 2.4;
    this.#pillarsPassed = 0;
    this.#miniScore = 0;
    this.#isPlaying = false;
    this.#isGameOver = false;
    this.#hasWon = false;
    this.#sessionId = null;
  }

  create() {
    super.create();
    this.cameras.main.setBackgroundColor('#070415');
    this.cameras.main.fadeIn(300);

    const session = TimeManager.beginSession('blockFlyer');
    if (!session) {
      this.scene.start(SCENE_KEYS.WORLD_SCENE);
      return;
    }
    this.#sessionId = session.sessionId;

    // 1. Build Background Layers
    this.#buildParallaxBackground();

    // 2. Trail Graphics Layer
    this.#trailGraphics = this.add.graphics().setDepth(15);

    // 3. Player Cat Sprite
    const catChoice = runState.hunter || dataManager.getPlayerCat() || 'cat-1';
    const catKey = this.textures.exists(catChoice) ? catChoice : 'PLAYER';
    this.#catSprite = this.add.image(this.#player.x, this.#player.y, catKey)
      .setDepth(20)
      .setOrigin(0.5, 0.5);
    this.#catSprite.setDisplaySize(36, 32);

    // 4. Build HUD
    this.#createHUD();

    // 5. Setup Controls
    this.#setupControls();

    // 6. Spawn Initial Pillars
    this.#spawnInitialPillars();

    // 7. 3-2-1 Countdown
    this.#startCountdown();
  }

  update(time, delta) {
    // 1. Update Neon Trail points
    this.#updateTrail();

    // Hover bob during countdown
    if (!this.#isPlaying && !this.#isGameOver && !this.#hasWon) {
      this.#player.y = 280 + Math.sin(time * 0.005) * 8;
      if (this.#catSprite && this.#catSprite.scene) {
        this.#catSprite.setPosition(this.#player.x, this.#player.y);
        this.#catSprite.setAngle(0);
      }
      return;
    }

    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    const timeStatus = TimeManager.tick(delta);
    if (timeStatus.worldExpired) {
      this.#triggerDefeat('WORLD TIMELINE EXPIRED');
      return;
    }
    if (timeStatus.sessionExpired) {
      this.#triggerDefeat('TIMEOUT: HIGH-FREQUENCY AIRSPACE EXPIRED');
      return;
    }

    this.#updateTimerDisplay();

    // 2. Physics Step
    this.#player.vy += this.#player.gravity;
    this.#player.y += this.#player.vy;

    // Smooth rotation based on vertical speed
    const targetAngle = Math.min(28, Math.max(-26, this.#player.vy * 4.0));
    if (this.#catSprite && this.#catSprite.scene) {
      this.#catSprite.setPosition(this.#player.x, this.#player.y);
      this.#catSprite.setAngle(targetAngle);
    }

    // 3. Ceiling & Ground Collisions
    if (this.#player.y - this.#player.height / 2 <= CEILING_Y) {
      this.#triggerDefeat('CEILING BREACH: IMPACT DETECTED');
      return;
    }
    if (this.#player.y + this.#player.height / 2 >= FLOOR_Y) {
      this.#triggerDefeat('GROUND COLLISION: CRASH DETECTED');
      return;
    }

    // 4. Parallax Background Scroll
    this.#scrollParallax();

    // 5. Pillars & Obstacles Update
    this.#updatePillars(time);
  }

  // ==========================================
  // PARALLAX BACKGROUND
  // ==========================================
  #buildParallaxBackground() {
    // Sky gradient rectangle
    const sky = this.add.graphics().setDepth(1);
    sky.fillGradientStyle(0x060216, 0x060216, 0x180b38, 0x180b38, 1);
    sky.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Star dots in sky
    const stars = this.add.graphics().setDepth(2);
    stars.fillStyle(0x00E5FF, 0.7);
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % CANVAS_WIDTH;
      const sy = (i * 37) % (CEILING_Y + 160);
      stars.fillCircle(sx, sy, (i % 3 === 0) ? 1.5 : 1);
    }

    // Far Layer: City Chunks tiled side by side
    const chunkKeys = [
      'flyer-bg-city-chunk-1',
      'flyer-bg-city-chunk-2',
      'flyer-bg-city-chunk-3',
      'flyer-bg-city-chunk-1',
      'flyer-bg-city-chunk-2',
      'flyer-bg-city-chunk-3',
    ];

    let currentX = 0;
    chunkKeys.forEach((key) => {
      const chunk = this.add.image(currentX, FLOOR_Y - 2, key)
        .setOrigin(0, 1)
        .setDepth(3)
        .setAlpha(0.85);
      const scale = 380 / chunk.height;
      chunk.setScale(scale);
      this.#cityChunks.push(chunk);
      currentX += chunk.displayWidth - 1;
    });

    // Floor Layer: ground-strip
    const groundScale = (CANVAS_HEIGHT - FLOOR_Y) / 158;
    const stripDisplayWidth = 2752 * groundScale;
    for (let i = 0; i < 2; i++) {
      const ground = this.add.image(i * (stripDisplayWidth - 2), FLOOR_Y, 'flyer-ground-strip')
        .setOrigin(0, 0)
        .setDepth(25);
      ground.setScale(groundScale);
      this.#groundStrips.push(ground);
    }
  }

  #scrollParallax() {
    // Far City Chunks scroll (slow)
    const cityDelta = this.#scrollSpeed * 0.35;
    this.#cityScrollX -= cityDelta;

    this.#cityChunks.forEach((chunk) => {
      chunk.x -= cityDelta;
      if (chunk.x + chunk.displayWidth < 0) {
        let rightmostX = 0;
        this.#cityChunks.forEach((c) => {
          if (c.x + c.displayWidth > rightmostX) rightmostX = c.x + c.displayWidth;
        });
        chunk.x = rightmostX - 2;
      }
    });

    // Ground Strips scroll (fast, matches pillars)
    this.#groundStrips.forEach((strip) => {
      strip.x -= this.#scrollSpeed;
      if (strip.x + strip.displayWidth < 0) {
        let maxX = 0;
        this.#groundStrips.forEach((s) => {
          if (s.x + s.displayWidth > maxX) maxX = s.x + s.displayWidth;
        });
        strip.x = maxX - 2;
      }
    });
  }

  // ==========================================
  // HUD
  // ==========================================
  #createHUD() {
    const hudY = 28;

    this.add.rectangle(CANVAS_WIDTH / 2, hudY, CANVAS_WIDTH - 40, 48, 0x090518, 0.95)
      .setStrokeStyle(2, 0x00E5FF, 0.85)
      .setDepth(50);

    this.add.text(35, hudY - 12, '// BLOCK FLYER // HIGH-FREQUENCY AIRSPACE //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setDepth(51);

    this.add.text(35, hudY + 4, `OPERATIVE: ${runState.name || 'HUNTER'} • UNIT: ${runState.hunter?.toUpperCase() || 'CYAN'}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
    }).setDepth(51);

    this.#pillarsText = this.add.text(CANVAS_WIDTH * 0.45, hudY - 10, `PILLARS: 0/${WIN_PILLARS}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    this.#pillarsBarGraphics = this.add.graphics().setDepth(51);
    this.#updatePillarsBar();

    this.#scoreText = this.add.text(CANVAS_WIDTH * 0.65, hudY, `SCORE: ${this.#miniScore} BIT`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    this.#timerText = this.add.text(CANVAS_WIDTH - 150, hudY, 'TIME: 01:30', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    this.#worldTimerText = this.add.text(CANVAS_WIDTH - 55, hudY, 'WORLD: --:--', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#8E8AAB',
    }).setOrigin(0.5, 0.5).setDepth(51);
  }

  #updateHUD() {
    if (!this.#pillarsText || !this.#pillarsText.scene) return;
    this.#pillarsText.setText(`PILLARS: ${this.#pillarsPassed}/${WIN_PILLARS}`);
    if (this.#scoreText && this.#scoreText.scene) {
      this.#scoreText.setText(`SCORE: ${this.#miniScore} BIT`);
    }
    this.#updatePillarsBar();
  }

  #updateTimerDisplay() {
    if (!this.#timerText?.scene || !this.#worldTimerText?.scene) return;
    const readout = TimeManager.getLiveReadout();
    this.#timerText.setText(`TIME: ${readout.formattedSessionTime}`);
    this.#worldTimerText.setText(`WORLD: ${readout.formattedLiveWorldTime}`);

    if (readout.sessionRemainingSec <= 10) {
      this.#timerText.setColor('#FF3366');
    } else {
      this.#timerText.setColor('#00E5FF');
    }

    if (readout.liveWorldRemainingSec <= 60) {
      this.#worldTimerText.setColor('#FF3366');
    } else {
      this.#worldTimerText.setColor('#8E8AAB');
    }
  }

  #updatePillarsBar() {
    if (!this.#pillarsBarGraphics || !this.#pillarsBarGraphics.scene) return;
    this.#pillarsBarGraphics.clear();
    const barW = 140;
    const barH = 7;
    const barX = CANVAS_WIDTH * 0.45 - barW / 2;
    const barY = 28 + 10;

    this.#pillarsBarGraphics.fillStyle(0x130a2a, 1);
    this.#pillarsBarGraphics.fillRect(barX, barY, barW, barH);
    this.#pillarsBarGraphics.lineStyle(1, 0x00E5FF, 0.5);
    this.#pillarsBarGraphics.strokeRect(barX, barY, barW, barH);

    const ratio = Math.min(1, this.#pillarsPassed / WIN_PILLARS);
    if (ratio > 0) {
      this.#pillarsBarGraphics.fillStyle(0x00FF66, 1);
      this.#pillarsBarGraphics.fillRect(barX + 1, barY + 1, (barW - 2) * ratio, barH - 2);
    }
  }

  // ==========================================
  // CONTROLS & FLAP ACTION
  // ==========================================
  #setupControls() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    const doFlap = () => this.#handleFlap();

    keyboard.on('keydown-SPACE', doFlap);
    keyboard.on('keydown-W', doFlap);
    keyboard.on('keydown-UP', doFlap);
    this.input.on('pointerdown', doFlap);
  }

  #handleFlap() {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    this.#player.vy = this.#player.flapStrength;

    // Burst of magenta/cyan flap particles
    for (let i = 0; i < 4; i++) {
      this.#trailPoints.push({
        x: this.#player.x - 16 - i * 4,
        y: this.#player.y + Phaser.Math.Between(-6, 6),
        alpha: 1,
        color: (i % 2 === 0) ? 0x00E5FF : 0xFF00FF,
      });
    }
  }

  // ==========================================
  // LONG CYAN-MAGENTA RIBBON & FLOATING BTC PARTICLES
  // ==========================================
  #updateTrail() {
    if (!this.#trailGraphics || !this.#trailGraphics.scene) return;
    this.#trailGraphics.clear();

    // Disabled when Reduce Motion is on
    if (isReduceMotionActive()) {
      this.#ribbonHistory = [];
      this.#btcParticles = [];
      this.#trailPoints = [];
      return;
    }

    // 1. Record ribbon point at the rear of the flying cat
    if (this.#catSprite && this.#catSprite.scene && !this.#isGameOver) {
      const catRearX = this.#player.x - 16;
      const catRearY = this.#player.y + 2;

      this.#ribbonHistory.unshift({
        x: catRearX,
        y: catRearY,
      });

      if (this.#ribbonHistory.length > 36) {
        this.#ribbonHistory.pop();
      }

      // Spawn floating BTC pixel particles off the ribbon
      if (this.#isPlaying && Phaser.Math.Between(0, 100) < 45) {
        this.#btcParticles.push({
          x: catRearX - Phaser.Math.Between(5, 30),
          y: catRearY + Phaser.Math.Between(-8, 8),
          vx: -this.#scrollSpeed * 0.85 + Phaser.Math.FloatBetween(-0.4, 0.4),
          vy: Phaser.Math.FloatBetween(-1.2, -0.3),
          alpha: 1,
          size: Phaser.Math.Between(4, 7),
          color: Phaser.Math.RND.pick([0xFFD700, 0xFFEE55, 0xFFA500]),
        });
      }
    }

    // 2. Draw continuous dual-tone cyan-magenta ribbon
    const pts = this.#ribbonHistory;
    for (let i = 0; i < pts.length; i++) {
      pts[i].x -= this.#scrollSpeed * 0.95;
    }

    if (pts.length >= 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];

        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.2) continue;

        const nx = -dy / dist;
        const ny = dx / dist;

        const t0 = 1 - (i / pts.length);
        const t1 = 1 - ((i + 1) / pts.length);

        const w0 = Math.max(2, 14 * t0);
        const w1 = Math.max(2, 14 * t1);

        const a0 = 0.88 * t0;

        // Top half: Glowing Cyan (0x00E5FF)
        this.#trailGraphics.fillStyle(0x00E5FF, a0);
        this.#trailGraphics.beginPath();
        this.#trailGraphics.moveTo(p0.x, p0.y);
        this.#trailGraphics.lineTo(p0.x + nx * (w0 / 2), p0.y + ny * (w0 / 2));
        this.#trailGraphics.lineTo(p1.x + nx * (w1 / 2), p1.y + ny * (w1 / 2));
        this.#trailGraphics.lineTo(p1.x, p1.y);
        this.#trailGraphics.closePath();
        this.#trailGraphics.fillPath();

        // Bottom half: Glowing Magenta (0xFF00FF)
        this.#trailGraphics.fillStyle(0xFF00FF, a0);
        this.#trailGraphics.beginPath();
        this.#trailGraphics.moveTo(p0.x, p0.y);
        this.#trailGraphics.lineTo(p0.x - nx * (w0 / 2), p0.y - ny * (w0 / 2));
        this.#trailGraphics.lineTo(p1.x - nx * (w1 / 2), p1.y - ny * (w1 / 2));
        this.#trailGraphics.lineTo(p1.x, p1.y);
        this.#trailGraphics.closePath();
        this.#trailGraphics.fillPath();

        // Center spine: White glow line
        this.#trailGraphics.lineStyle(1.5, 0xFFFFFF, a0 * 0.95);
        this.#trailGraphics.lineBetween(p0.x, p0.y, p1.x, p1.y);

        // Soft outer ambient halo
        this.#trailGraphics.lineStyle(w0 + 6, 0x00E5FF, a0 * 0.18);
        this.#trailGraphics.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
    }

    // 3. Update & render floating BTC pixel particles
    for (let i = this.#btcParticles.length - 1; i >= 0; i--) {
      const btc = this.#btcParticles[i];
      btc.x += btc.vx;
      btc.y += btc.vy;
      btc.alpha -= 0.02;

      if (btc.alpha <= 0 || btc.x < 0) {
        this.#btcParticles.splice(i, 1);
        continue;
      }

      // Outer gold aura
      this.#trailGraphics.fillStyle(0xFFD700, btc.alpha * 0.35);
      this.#trailGraphics.fillCircle(btc.x, btc.y, btc.size * 0.9);

      // Gold coin pixel
      this.#trailGraphics.fillStyle(btc.color, btc.alpha);
      this.#trailGraphics.fillRect(btc.x - btc.size / 2, btc.y - btc.size / 2, btc.size, btc.size);

      // Inner white sparkle core
      this.#trailGraphics.fillStyle(0xFFFFFF, btc.alpha * 0.9);
      this.#trailGraphics.fillRect(btc.x - 1, btc.y - 1, 2, 2);
    }
  }

  // ==========================================
  // 3-2-1 COUNTDOWN
  // ==========================================
  #startCountdown() {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    const overlay = this.add.rectangle(cx, cy, CANVAS_WIDTH, CANVAS_HEIGHT, 0x05020d, 0.75)
      .setDepth(100);

    const bannerText = this.add.text(cx, cy - 60, '// AIRSPACE NAVIGATION PROTOCOL //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const countText = this.add.text(cx, cy + 10, '3', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '76px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const steps = [
      { text: '3', color: '#00E5FF', scale: 1.5 },
      { text: '2', color: '#3FF0FF', scale: 1.5 },
      { text: '1', color: '#FFD700', scale: 1.5 },
      { text: 'THRUST ENGAGED!', color: '#00FF66', scale: 1.2 },
    ];

    let currentStep = 0;

    const runStep = () => {
      if (currentStep >= steps.length) {
        this.tweens.add({
          targets: [overlay, bannerText, countText],
          alpha: 0,
          duration: 250,
          onComplete: () => {
            overlay.destroy();
            bannerText.destroy();
            countText.destroy();
            this.#isPlaying = true;
          },
        });
        return;
      }

      const item = steps[currentStep];
      countText.setText(item.text);
      countText.setColor(item.color);
      countText.setScale(item.scale);
      countText.setAlpha(1);

      this.tweens.add({
        targets: countText,
        scale: 1,
        alpha: 0.8,
        duration: 550,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          currentStep++;
          runStep();
        },
      });
    };

    runStep();
  }

  // ==========================================
  // PILLARS, DRONES & GOLD COINS
  // ==========================================
  #spawnInitialPillars() {
    for (let i = 0; i < 4; i++) {
      const spawnX = 640 + i * PILLAR_SPACING;
      this.#createPillar(spawnX);
    }
  }

  #createPillar(x) {
    const id = this.#nextPillarId++;
    const gapY = Phaser.Math.Between(130, 290);

    // Top pillar
    const topHeight = gapY - CEILING_Y;
    const topSprite = this.add.image(x, gapY, 'flyer-pillar-top')
      .setOrigin(0.5, 1)
      .setDepth(10);
    topSprite.setDisplaySize(PILLAR_WIDTH, topHeight);

    // Bottom pillar
    const bottomHeight = FLOOR_Y - (gapY + GAP_HEIGHT);
    const bottomKey = (id % 2 === 0) ? 'flyer-pillar-bottom' : 'flyer-tower-server';
    const bottomSprite = this.add.image(x, gapY + GAP_HEIGHT, bottomKey)
      .setOrigin(0.5, 0)
      .setDepth(10);
    bottomSprite.setDisplaySize(PILLAR_WIDTH, bottomHeight);

    // Gold Coin in gap
    const coinY = gapY + GAP_HEIGHT / 2;
    const coin = this.add.image(x, coinY, 'coin-btc-gold')
      .setOrigin(0.5, 0.5)
      .setDisplaySize(24, 24)
      .setDepth(12);

    const baseCoinScale = coin.scaleX;
    this.tweens.add({
      targets: coin,
      scaleX: { from: baseCoinScale, to: baseCoinScale * 0.2 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Drones start appearing from pillar 5 onwards
    let drone = null;
    let droneBaseY = 0;
    if (id >= 4) { // 5th pillar onwards
      droneBaseY = gapY + GAP_HEIGHT / 2 + Phaser.Math.Between(-25, 25);
      drone = this.add.image(x + PILLAR_SPACING / 2, droneBaseY, 'flyer-drone')
        .setOrigin(0.5, 0.5)
        .setDisplaySize(42, 24)
        .setDepth(14);
    }

    this.#pillars.push({
      id,
      x,
      gapY,
      gapHeight: GAP_HEIGHT,
      passed: false,
      topSprite,
      bottomSprite,
      coin,
      coinCollected: false,
      drone,
      droneBaseY,
    });
  }

  #updatePillars(time) {
    const px = this.#player.x;
    const py = this.#player.y;
    const pW = this.#player.width - 8;
    const pH = this.#player.height - 8;
    const pilW = PILLAR_WIDTH - 12;

    for (let i = this.#pillars.length - 1; i >= 0; i--) {
      const pil = this.#pillars[i];
      pil.x -= this.#scrollSpeed;
      pil.topSprite.setX(pil.x);
      pil.bottomSprite.setX(pil.x);

      if (pil.coin) {
        pil.coin.setX(pil.x);
      }

      if (pil.drone) {
        pil.drone.setX(pil.x + PILLAR_SPACING / 2);
        pil.drone.setY(pil.droneBaseY + Math.sin(time * 0.004 + pil.id) * 22);
      }

      // 1. Pillar Passed Check (+10 score)
      if (!pil.passed && pil.x + PILLAR_WIDTH / 2 < px) {
        pil.passed = true;
        this.#pillarsPassed++;
        this.#miniScore += 10;
        runState.addScore(10);
        this.#updateHUD();

        // Speed up at pillars 5, 10, and 15
        if (this.#pillarsPassed === 5) {
          this.#scrollSpeed = 2.8;
          this.#showFloatingText(CANVAS_WIDTH / 2, 120, 'OVERCLOCK: SPEED UP // 2.8x', '#3FF0FF');
        } else if (this.#pillarsPassed === 10) {
          this.#scrollSpeed = 3.3;
          this.#showFloatingText(CANVAS_WIDTH / 2, 120, 'OVERCLOCK: SPEED UP // 3.3x', '#FFD700');
        } else if (this.#pillarsPassed === 15) {
          this.#scrollSpeed = 3.8;
          this.#showFloatingText(CANVAS_WIDTH / 2, 120, 'MAXIMUM VELOCITY // 3.8x', '#FF0055');
        }

        // Win condition: 20 pillars passed
        if (this.#pillarsPassed >= WIN_PILLARS) {
          this.#triggerVictory();
          return;
        }
      }

      // 2. Gold Coin Collection (+25 score)
      if (pil.coin && !pil.coinCollected) {
        const coinDist = Phaser.Math.Distance.Between(px, py, pil.coin.x, pil.coin.y);
        if (coinDist < 26) {
          pil.coinCollected = true;
          pil.coin.setVisible(false);
          this.#miniScore += 25;
          runState.addScore(25);
          this.#showFloatingText(pil.coin.x, pil.coin.y, '+25 BIT', '#FFD700');
          this.#updateHUD();
        }
      }

      // 3. Collision with Top / Bottom Pillars
      const hitX = px + pW / 2 > pil.x - pilW / 2 && px - pW / 2 < pil.x + pilW / 2;
      if (hitX) {
        const hitTop = py - pH / 2 < pil.gapY - 4;
        const hitBottom = py + pH / 2 > pil.gapY + pil.gapHeight + 4;
        if (hitTop || hitBottom) {
          this.#triggerDefeat('INFRASTRUCTURE IMPACT: SERVER PILLAR');
          return;
        }
      }

      // 4. Collision with Drone
      if (pil.drone && pil.drone.visible) {
        const droneDist = Phaser.Math.Distance.Between(px, py, pil.drone.x, pil.drone.y);
        if (droneDist < 24) {
          this.#triggerDefeat('INTERCEPTION: PATROL DRONE COLLISION');
          return;
        }
      }

      // Recycle offscreen pillars
      if (pil.x < -100) {
        pil.topSprite.destroy();
        pil.bottomSprite.destroy();
        if (pil.coin) pil.coin.destroy();
        if (pil.drone) pil.drone.destroy();
        this.#pillars.splice(i, 1);

        const lastPillar = this.#pillars[this.#pillars.length - 1];
        const newX = (lastPillar ? lastPillar.x : CANVAS_WIDTH) + PILLAR_SPACING;
        this.#createPillar(newX);
      }
    }
  }

  // ==========================================
  // FLOATING TEXT
  // ==========================================
  #showFloatingText(x, y, message, color = '#00FF66') {
    const txt = this.add.text(x, y, message, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

    this.tweens.add({
      targets: txt,
      y: y - 35,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ==========================================
  // WIN & DEFEAT OUTCOMES
  // ==========================================
  #triggerVictory() {
    if (this.#hasWon || this.#isGameOver) return;
    this.#hasWon = true;
    this.#isPlaying = false;

    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, SESSION_END_REASONS.WIN);
    }

    this.cameras.main.flash(350, 0, 255, 100);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    this.add.rectangle(cx, cy, 640, 160, 0x072818, 0.96)
      .setStrokeStyle(3, 0x00FF66, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// AIRSPACE PROTOCOL COMPLETED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'AIRSPACE SECURED!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '36px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, '20/20 PILLARS CLEARED • RETURNING TO BATTLE PROTOCOL...', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#A8FFD0',
    }).setOrigin(0.5).setDepth(151);

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
          ...this._data,
          mode: 'win',
        });
      });
    });
  }

  #triggerDefeat(reason = 'COLLISION DETECTED') {
    if (this.#isGameOver || this.#hasWon) return;
    this.#isGameOver = true;
    this.#isPlaying = false;

    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, SESSION_END_REASONS.DEFEAT);
    }

    this.cameras.main.shake(400, 0.025);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    this.add.rectangle(cx, cy, 640, 160, 0x2e0617, 0.96)
      .setStrokeStyle(3, 0xFF0055, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// EXCEPTION: AIRSPACE BREACH //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FF6688',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'AIRSPACE COLLAPSE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '38px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, `${reason} • LOSING OPERATIVE LIFE...`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FFC0D0',
    }).setOrigin(0.5).setDepth(151);

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
          ...this._data,
          mode: 'lose',
        });
      });
    });
  }

  // Debug / Test methods
  getPlayerY() {
    return this.#player.y;
  }

  simulateFlap() {
    this.#handleFlap();
  }

  getPillarsPassed() {
    return this.#pillarsPassed;
  }

  incrementPillarsDebug(count = 1) {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
    this.#pillarsPassed += count;
    this.#miniScore += 10 * count;
    runState.addScore(10 * count);
    this.#updateHUD();
    if (this.#pillarsPassed >= WIN_PILLARS) {
      this.#triggerVictory();
    }
  }
}
