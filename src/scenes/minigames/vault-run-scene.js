import Phaser from '../../lib/phaser.js';
import { BaseScene } from '../base-scene.js';
import { SCENE_KEYS } from '../scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../../assets/font-keys.js';
import { dataManager } from '../../utils/data-manager.js';
import { runState } from '../../state/run-state.js';
import { ScoreManager } from '../../systems/score-manager.js';
import { TimeManager, SESSION_END_REASONS } from '../../systems/time-manager.js';
import {
  VAULT_TILE_SIZE,
  VAULT_MAZE_COLS,
  VAULT_MAZE_ROWS,
  VAULT_OFFSET_X,
  VAULT_OFFSET_Y,
  VAULT_FRIGHTENED_DURATION_MS,
  VAULT_INVULNERABILITY_MS,
  VAULT_PLAYER_SPEED,
  VAULT_APE_NORMAL_SPEED,
  VAULT_APE_FRIGHTENED_SPEED,
  VAULT_PELLET_VALUE,
  VAULT_POWER_COIN_VALUE,
  VAULT_APE_EAT_VALUE,
  VAULT_PLAYER_SPAWN,
  VAULT_APE_CONFIGS,
  VAULT_WRAP_ROW,
  VAULT_MAZE_GRID,
} from '../../config/vault-run-config.js';

export class VaultRunScene extends BaseScene {
  /** @type {object} */
  _data = {};

  // Session ID from TimeManager
  /** @type {string | null} */
  #sessionId = null;

  // Player state
  /** @type {{
   *   x: number,
   *   y: number,
   *   col: number,
   *   row: number,
   *   prevCol: number,
   *   prevRow: number,
   *   dirX: number,
   *   dirY: number,
   *   nextDirX: number,
   *   nextDirY: number,
   *   speed: number,
   *   isInvulnerable: boolean,
   *   invulnerableTimer: number
   * }} */
  #player = {
    x: 0,
    y: 0,
    col: Number(VAULT_PLAYER_SPAWN.col),
    row: Number(VAULT_PLAYER_SPAWN.row),
    prevCol: Number(VAULT_PLAYER_SPAWN.col),
    prevRow: Number(VAULT_PLAYER_SPAWN.row),
    dirX: Number(VAULT_PLAYER_SPAWN.dirX),
    dirY: Number(VAULT_PLAYER_SPAWN.dirY),
    nextDirX: Number(VAULT_PLAYER_SPAWN.dirX),
    nextDirY: Number(VAULT_PLAYER_SPAWN.dirY),
    speed: VAULT_PLAYER_SPEED,
    isInvulnerable: false,
    invulnerableTimer: 0,
  };

  /** @type {Phaser.GameObjects.Image} */
  #catSprite;

  /** @type {Phaser.GameObjects.Graphics} */
  #catTrailGraphics;

  /** @type {Array<{x: number, y: number, alpha: number}>} */
  #catTrail = [];

  // Pellets & Power Coins
  /** @type {Array<{col: number, row: number, x: number, y: number, isBig: boolean, sprite: Phaser.GameObjects.GameObject}>} */
  #pellets = [];

  /** @type {number} */
  #pelletsLeft = 0;

  // Apes (Ghosts)
  /** @type {Array<{
   *   id: number,
   *   name: string,
   *   assetKey: string,
   *   homeCol: number,
   *   homeRow: number,
   *   x: number,
   *   y: number,
   *   col: number,
   *   row: number,
   *   prevCol: number,
   *   prevRow: number,
   *   dirX: number,
   *   dirY: number,
   *   speed: number,
   *   releaseDelayMs: number,
   *   isReleased: boolean,
   *   state: 'house' | 'exiting' | 'active',
   *   personality: string,
   *   scatterTarget?: { col: number, row: number },
   *   sprite: Phaser.GameObjects.Image
   * }>} */
  #apes = [];

  /** @type {boolean} */
  #isFrightened = false;

  /** @type {number} */
  #frightenedTimer = 0;

  // Game state
  /** @type {number} */
  #miniScore = 0;

  /** @type {boolean} */
  #isPlaying = false;

  /** @type {boolean} */
  #isGameOver = false;

  /** @type {boolean} */
  #hasWon = false;

  /** @type {number} */
  #gameplayElapsedMs = 0;

  // Visuals & HUD
  /** @type {Phaser.GameObjects.Graphics} */
  #mazeGraphics;

  /** @type {Phaser.GameObjects.Text} */
  #pelletsText;

  /** @type {Phaser.GameObjects.Text} */
  #scoreText;

  /** @type {Phaser.GameObjects.Text} */
  #timerText;

  /** @type {Phaser.GameObjects.Text} */
  #worldTimerText;

  // Debug overlay (F1)
  /** @type {boolean} */
  #isDebugActive = false;

  /** @type {Phaser.GameObjects.Graphics | null} */
  #debugGraphics = null;

  // Interactive Modals (Death Continue & ESC Exit)
  /** @type {Phaser.GameObjects.Container | null} */
  #modalContainer = null;

  /** @type {'death' | 'exit' | null} */
  #activeModalType = null;

  /** @type {number} */
  #modalSelectedIndex = 0;

  /** @type {Array<Phaser.GameObjects.Rectangle>} */
  #modalButtonBgs = [];

  /** @type {Array<Phaser.GameObjects.Text>} */
  #modalButtonTexts = [];

  constructor() {
    super({ key: SCENE_KEYS.VAULT_RUN_SCENE });
  }

  init(data) {
    super.init(data);
    this._data = data || {};

    this.#player = {
      x: 0,
      y: 0,
      col: Number(VAULT_PLAYER_SPAWN.col),
      row: Number(VAULT_PLAYER_SPAWN.row),
      prevCol: Number(VAULT_PLAYER_SPAWN.col),
      prevRow: Number(VAULT_PLAYER_SPAWN.row),
      dirX: Number(VAULT_PLAYER_SPAWN.dirX),
      dirY: Number(VAULT_PLAYER_SPAWN.dirY),
      nextDirX: Number(VAULT_PLAYER_SPAWN.dirX),
      nextDirY: Number(VAULT_PLAYER_SPAWN.dirY),
      speed: VAULT_PLAYER_SPEED,
      isInvulnerable: false,
      invulnerableTimer: 0,
    };

    this.#catTrail = [];
    this.#pellets = [];
    this.#pelletsLeft = 0;
    this.#apes = [];
    this.#isFrightened = false;
    this.#frightenedTimer = 0;
    this.#miniScore = 0;
    this.#isPlaying = false;
    this.#isGameOver = false;
    this.#hasWon = false;
    this.#gameplayElapsedMs = 0;
    this.#sessionId = null;
    this.#isDebugActive = false;

    this.#modalContainer = null;
    this.#activeModalType = null;
    this.#modalSelectedIndex = 0;
    this.#modalButtonBgs = [];
    this.#modalButtonTexts = [];
  }

  create() {
    super.create();
    this.cameras.main.setBackgroundColor('#050110');
    this.cameras.main.fadeIn(300);

    // 1. Begin Session with TimeManager (ensuring world time is valid)
    if (TimeManager.worldRemainingMs <= 0) {
      TimeManager.reset();
    }
    let session = TimeManager.beginSession('vaultRun');
    if (!session) {
      TimeManager.reset();
      session = TimeManager.beginSession('vaultRun');
    }
    if (session) {
      this.#sessionId = session.sessionId;
    }

    // 2. Draw Arcade Side Marquee & Neon Grid Background
    this.#drawBackgroundDetails();

    // 3. Draw Maze Walls from single source of truth (VAULT_MAZE_GRID)
    this.#drawMazeWalls();

    // 4. Spawn Pellets & Power Coins
    this.#spawnPellets();

    // 5. Cat Trail Layer
    this.#catTrailGraphics = this.add.graphics().setDepth(15);

    // 6. Spawn Player Cat at validated open spawn tile
    const catChoice = runState.hunter || dataManager.getPlayerCat() || 'cat-1';
    const catKey = this.textures.exists(catChoice) ? catChoice : 'PLAYER';
    this.#resetPlayerPosition();

    this.#catSprite = this.add.image(this.#player.x, this.#player.y, catKey)
      .setDepth(20)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(18, 18);

    // 7. Spawn 4 Hacker Apes in Vault
    this.#spawnApes();

    // 8. Setup HUD (including dual timer: session + WORLD countdown)
    this.#createHUD();

    // 9. Setup Controls with event.preventDefault()
    this.#setupControls();

    // 10. Debug Overlay
    this.#debugGraphics = this.add.graphics().setDepth(90);
    this.#debugGraphics.setVisible(false);

    // 11. Start Quick "READY! / BREACH!" Countdown
    this.#startCountdown();
  }

  #getTileCenterX(col) {
    return VAULT_OFFSET_X + col * VAULT_TILE_SIZE + VAULT_TILE_SIZE / 2;
  }

  #getTileCenterY(row) {
    return VAULT_OFFSET_Y + row * VAULT_TILE_SIZE + VAULT_TILE_SIZE / 2;
  }

  #resetPlayerPosition() {
    this.#player.col = VAULT_PLAYER_SPAWN.col;
    this.#player.row = VAULT_PLAYER_SPAWN.row;
    this.#player.prevCol = VAULT_PLAYER_SPAWN.col;
    this.#player.prevRow = VAULT_PLAYER_SPAWN.row;
    this.#player.dirX = VAULT_PLAYER_SPAWN.dirX;
    this.#player.dirY = VAULT_PLAYER_SPAWN.dirY;
    this.#player.nextDirX = VAULT_PLAYER_SPAWN.dirX;
    this.#player.nextDirY = VAULT_PLAYER_SPAWN.dirY;
    this.#player.x = this.#getTileCenterX(this.#player.col);
    this.#player.y = this.#getTileCenterY(this.#player.row);
    if (this.#catSprite) {
      this.#catSprite.setPosition(this.#player.x, this.#player.y);
      this.#catSprite.setAlpha(1);
    }
  }

  update(time, delta) {
    this.#updateTrail();
    this.#updateTimerDisplay();

    // If modal is active or game ended, do not tick gameplay
    if (this.#activeModalType || !this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    // TimeManager tick
    const timeStatus = TimeManager.tick(delta);
    if (timeStatus.worldExpired) {
      this.#triggerDefeat(SESSION_END_REASONS.WORLD_TIME_UP, 'WORLD TIMELINE EXPIRED: REWRITE FAILED');
      return;
    }
    if (timeStatus.sessionExpired) {
      this.#triggerDefeat(SESSION_END_REASONS.TIMEOUT, 'SECURITY LOCKDOWN: PROTOCOL TIMEOUT');
      return;
    }

    this.#gameplayElapsedMs += delta;
    this.#updateTimerDisplay();

    // Handle Player Invulnerability
    if (this.#player.isInvulnerable) {
      this.#player.invulnerableTimer -= delta;
      const isBlink = Math.floor(time / 100) % 2 === 0;
      this.#catSprite.setAlpha(isBlink ? 0.3 : 1);
      if (this.#player.invulnerableTimer <= 0) {
        this.#player.isInvulnerable = false;
        this.#catSprite.setAlpha(1);
      }
    }

    // Update Frightened Timer
    if (this.#isFrightened) {
      this.#frightenedTimer -= delta;
      if (this.#frightenedTimer <= 0) {
        this.#endFrightenedMode();
      } else if (this.#frightenedTimer < 1800) {
        // Flash between blue and white to warn expiration
        const isBlink = Math.floor(time / 150) % 2 === 0;
        this.#apes.forEach((ape) => {
          ape.sprite.setTint(isBlink ? 0xFFFFFF : 0x00B0FF);
        });
      }
    }

    // Step Player with Genuine Arcade Grid Motion
    this.#updatePlayer();

    // Step Apes with Authentic Ghost AI
    this.#updateApes(delta);

    // Check Collisions between Player and Apes
    this.#checkApeCollisions();

    // Update F1 Debug Graphics if active
    if (this.#isDebugActive) {
      this.#renderDebugOverlay();
    }
  }

  // ==========================================
  // BACKGROUND & NEON MAZE RENDERING
  // ==========================================
  #drawBackgroundDetails() {
    const bg = this.add.graphics().setDepth(1);

    // Deep space backdrop
    bg.fillStyle(0x060212, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Grid dots across background
    bg.fillStyle(0x1a1236, 0.6);
    for (let x = 16; x < this.scale.width; x += 32) {
      for (let y = 16; y < this.scale.height; y += 32) {
        bg.fillCircle(x, y, 1);
      }
    }

    // Side Marquee Borders (Left & Right Arcade Panels)
    const panelW = VAULT_OFFSET_X - 24;
    // Left decorative card
    this.add.rectangle(VAULT_OFFSET_X / 2 - 2, this.scale.height / 2 + 10, panelW, 440, 0x090518, 0.85)
      .setStrokeStyle(2, 0x00E5FF, 0.7)
      .setDepth(2);

    this.add.text(VAULT_OFFSET_X / 2 - 2, 120, '// VAULT PROTOCOL //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(VAULT_OFFSET_X / 2 - 2, 160, 'CRYPTOGRAPHIC\nLEDGER RUN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#FFFFFF',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(VAULT_OFFSET_X / 2 - 2, 240, 'RULES:\n• EAT ALL PELLETS\n• 4 CORNER COINS\n  OVERCLOCK APES\n• EAT VULNERABLE\n  APES FOR +200\n• AVOID APES\n\n[ESC] PAUSE / EXIT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(3);

    // Right decorative card
    const rightCenterX = this.scale.width - VAULT_OFFSET_X / 2 + 2;
    this.add.rectangle(rightCenterX, this.scale.height / 2 + 10, panelW, 440, 0x090518, 0.85)
      .setStrokeStyle(2, 0xFF00FF, 0.7)
      .setDepth(2);

    this.add.text(rightCenterX, 120, '// INTRUDER APES //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FF00FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(rightCenterX, 170, 'HACKER DAEMONS\nIN VAULT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    this.add.text(rightCenterX, 250, '• APE 1: CHASER\n• APE 2: CHASER\n• APE 3: WANDERER\n• APE 4: WANDERER\n\nSTATUS:\nMONITORING ACTIVE\n\n[F1] TOGGLE GRID', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(3);
  }

  #drawMazeWalls() {
    this.#mazeGraphics = this.add.graphics().setDepth(5);

    // Maze Floor Dark Fill
    this.#mazeGraphics.fillStyle(0x0a051d, 0.95);
    this.#mazeGraphics.fillRect(VAULT_OFFSET_X, VAULT_OFFSET_Y, VAULT_MAZE_COLS * VAULT_TILE_SIZE, VAULT_MAZE_ROWS * VAULT_TILE_SIZE);

    // Render Walls with Cyan + Magenta Double Neon Lines directly from VAULT_MAZE_GRID
    for (let r = 0; r < VAULT_MAZE_ROWS; r++) {
      for (let c = 0; c < VAULT_MAZE_COLS; c++) {
        const char = VAULT_MAZE_GRID[r][c];
        const x = VAULT_OFFSET_X + c * VAULT_TILE_SIZE;
        const y = VAULT_OFFSET_Y + r * VAULT_TILE_SIZE;

        if (char === '#') {
          // Double neon line wall block
          this.#mazeGraphics.fillStyle(0x0c0722, 1);
          this.#mazeGraphics.fillRect(x, y, VAULT_TILE_SIZE, VAULT_TILE_SIZE);

          // Outer stroke (Cyan)
          this.#mazeGraphics.lineStyle(1.5, 0x00E5FF, 0.85);
          this.#mazeGraphics.strokeRect(x, y, VAULT_TILE_SIZE, VAULT_TILE_SIZE);

          // Inner stroke (Magenta)
          this.#mazeGraphics.lineStyle(1, 0xFF00FF, 0.65);
          this.#mazeGraphics.strokeRect(x + 2, y + 2, VAULT_TILE_SIZE - 4, VAULT_TILE_SIZE - 4);
        } else if (char === '-') {
          // Vault Door (Horizontal cyan laser gate)
          this.#mazeGraphics.fillStyle(0x00E5FF, 0.85);
          this.#mazeGraphics.fillRect(x, y + 6, VAULT_TILE_SIZE, 4);
        }
      }
    }

    // Vault Center Text & Label
    const vaultCenterX = VAULT_OFFSET_X + 14 * VAULT_TILE_SIZE;
    const vaultCenterY = VAULT_OFFSET_Y + 9 * VAULT_TILE_SIZE - 2;

    this.add.text(vaultCenterX, vaultCenterY, 'VAULT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
  }

  // ==========================================
  // PELLETS & POWER COINS
  // ==========================================
  #spawnPellets() {
    this.#pellets = [];
    this.#pelletsLeft = 0;

    for (let r = 0; r < VAULT_MAZE_ROWS; r++) {
      for (let c = 0; c < VAULT_MAZE_COLS; c++) {
        const char = VAULT_MAZE_GRID[r][c];
        const px = this.#getTileCenterX(c);
        const py = this.#getTileCenterY(r);

        if (char === '.') {
          // Regular Gold "B" pellet (+10)
          const pellet = this.add.text(px, py, 'B', {
            fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
            fontSize: '9px',
            color: '#FFD700',
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(7);

          this.#pellets.push({
            col: c,
            row: r,
            x: px,
            y: py,
            isBig: false,
            sprite: pellet,
          });
          this.#pelletsLeft++;
        } else if (char === 'O') {
          // Big Glowing BTC Coin in 4 Corners (+50)
          const coin = this.add.image(px, py, 'coin-btc-gold')
            .setOrigin(0.5, 0.5)
            .setDisplaySize(20, 20)
            .setDepth(8);

          this.tweens.add({
            targets: coin,
            scaleX: { from: coin.scaleX, to: coin.scaleX * 0.2 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });

          this.#pellets.push({
            col: c,
            row: r,
            x: px,
            y: py,
            isBig: true,
            sprite: coin,
          });
          this.#pelletsLeft++;
        }
      }
    }
  }

  // ==========================================
  // HACKER APES (GHOSTS) SPAWNING
  // ==========================================
  #spawnApes() {
    this.#apes = [];

    VAULT_APE_CONFIGS.forEach((cfg) => {
      const ax = this.#getTileCenterX(cfg.homeCol);
      const ay = this.#getTileCenterY(cfg.homeRow);
      const key = this.textures.exists(cfg.asset) ? cfg.asset : 'HACKER_APE_1';

      const sprite = this.add.image(ax, ay, key)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(18, 18)
        .setDepth(18);

      this.#apes.push({
        id: cfg.id,
        name: cfg.name,
        assetKey: key,
        homeCol: cfg.homeCol,
        homeRow: cfg.homeRow,
        x: ax,
        y: ay,
        col: cfg.homeCol,
        row: cfg.homeRow,
        prevCol: cfg.homeCol,
        prevRow: cfg.homeRow,
        dirX: 0,
        dirY: -1,
        speed: VAULT_APE_NORMAL_SPEED,
        releaseDelayMs: cfg.releaseDelayMs,
        isReleased: cfg.releaseDelayMs === 0,
        state: cfg.releaseDelayMs === 0 ? 'exiting' : 'house',
        personality: cfg.personality,
        scatterTarget: cfg.scatterTarget,
        sprite,
      });
    });
  }

  // ==========================================
  // HUD (DUAL TIMERS: SESSION + OVERWORLD)
  // ==========================================
  #createHUD() {
    const hudY = 28;
    const width = this.scale.width;

    this.add.rectangle(width / 2, hudY, width - 40, 48, 0x090518, 0.95)
      .setStrokeStyle(2, 0x00E5FF, 0.85)
      .setDepth(50);

    // Left info
    this.add.text(35, hudY - 12, '// VAULT RUN // CRYPTOGRAPHIC MAZE //', {
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

    // Pellets Left
    this.#pelletsText = this.add.text(width * 0.38, hudY, `PELLETS: ${this.#pelletsLeft}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Score
    this.#scoreText = this.add.text(width * 0.58, hudY, `SCORE: ${this.#miniScore} BIT`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Dual Timer: Session Countdown
    this.#timerText = this.add.text(width - 150, hudY, 'TIME: 01:30', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Synchronized World Countdown Readout
    this.#worldTimerText = this.add.text(width - 55, hudY, 'WORLD: --:--', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#8E8AAB',
    }).setOrigin(0.5, 0.5).setDepth(51);
  }

  #updateHUD() {
    if (!this.#pelletsText?.scene || !this.#scoreText?.scene) return;
    this.#pelletsText.setText(`PELLETS: ${this.#pelletsLeft}`);
    this.#scoreText.setText(`SCORE: ${this.#miniScore} BIT`);
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

  // ==========================================
  // CONTROLS & STEERING (PAC-MAN ARROW KEYS + MODAL SELECTION)
  // ==========================================
  #setupControls() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ESC,
      Phaser.Input.Keyboard.KeyCodes.F1,
    ]);

    keyboard.on('keydown-UP', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(0);
      } else {
        this.#setNextDirection(0, -1);
      }
    });

    keyboard.on('keydown-DOWN', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(1);
      } else {
        this.#setNextDirection(0, 1);
      }
    });

    keyboard.on('keydown-LEFT', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(0);
      } else {
        this.#setNextDirection(-1, 0);
      }
    });

    keyboard.on('keydown-RIGHT', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(1);
      } else {
        this.#setNextDirection(1, 0);
      }
    });

    keyboard.on('keydown-W', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(0);
      } else {
        this.#setNextDirection(0, -1);
      }
    });

    keyboard.on('keydown-S', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(1);
      } else {
        this.#setNextDirection(0, 1);
      }
    });

    keyboard.on('keydown-A', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(0);
      } else {
        this.#setNextDirection(-1, 0);
      }
    });

    keyboard.on('keydown-D', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#selectModalOption(1);
      } else {
        this.#setNextDirection(1, 0);
      }
    });

    // ENTER & SPACE to confirm dialog options
    keyboard.on('keydown-ENTER', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#confirmModalSelection();
      }
    });

    keyboard.on('keydown-SPACE', (e) => {
      e?.preventDefault?.();
      if (this.#activeModalType) {
        this.#confirmModalSelection();
      }
    });

    // ESC: Toggle Exit Modal
    keyboard.on('keydown-ESC', (e) => {
      e?.preventDefault?.();
      if (this.#isGameOver || this.#hasWon) return;

      if (this.#activeModalType === 'exit') {
        this.#closeModal();
        TimeManager.resume();
        this.#isPlaying = true;
      } else if (this.#activeModalType === 'death') {
        // Select NO (Abort) on ESC
        this.#selectModalOption(1);
        this.#confirmModalSelection();
      } else {
        this.#showExitModal();
      }
    });

    // F1: Toggle Debug Overlay
    keyboard.on('keydown-F1', (e) => {
      e?.preventDefault?.();
      this.#isDebugActive = !this.#isDebugActive;
      this.#debugGraphics?.setVisible(this.#isDebugActive);
      if (this.#isDebugActive) {
        this.#renderDebugOverlay();
      }
    });
  }

  #setNextDirection(dx, dy) {
    if (this.#activeModalType || this.#isGameOver || this.#hasWon) return;

    const p = this.#player;

    // Direct 180-degree reversal is applied immediately anywhere on a tile
    if (dx === -p.dirX && dy === -p.dirY && (p.dirX !== 0 || p.dirY !== 0)) {
      p.dirX = dx;
      p.dirY = dy;
      p.nextDirX = 0;
      p.nextDirY = 0;
      return;
    }

    // If currently stopped, immediately start moving if the direction is open
    if (this.#isPlaying && p.dirX === 0 && p.dirY === 0 && this.#canMove(p.col + dx, p.row + dy, false)) {
      p.dirX = dx;
      p.dirY = dy;
      p.nextDirX = 0;
      p.nextDirY = 0;
      return;
    }

    // Buffer turn for next tile intersection
    p.nextDirX = dx;
    p.nextDirY = dy;
  }

  // ==========================================
  // QUICK "READY! / BREACH!" COUNTDOWN
  // ==========================================
  #startCountdown() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05020d, 0.75)
      .setDepth(100);

    const bannerText = this.add.text(cx, cy - 50, '// VAULT INFILTRATION PROTOCOL //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const countText = this.add.text(cx, cy + 15, 'READY!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '64px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    const steps = [
      { text: 'READY!', color: '#00E5FF', scale: 1.2 },
      { text: 'BREACH!', color: '#00FF66', scale: 1.3 },
    ];

    let currentStep = 0;

    const runStep = () => {
      if (currentStep >= steps.length) {
        this.tweens.add({
          targets: [overlay, bannerText, countText],
          alpha: 0,
          duration: 180,
          onComplete: () => {
            overlay.destroy();
            bannerText.destroy();
            countText.destroy();
            this.#isPlaying = true;

            // If player queued a direction during countdown, apply it immediately
            if (this.#player.nextDirX !== 0 || this.#player.nextDirY !== 0) {
              if (this.#canMove(this.#player.col + this.#player.nextDirX, this.#player.row + this.#player.nextDirY, false)) {
                this.#player.dirX = this.#player.nextDirX;
                this.#player.dirY = this.#player.nextDirY;
                this.#player.nextDirX = 0;
                this.#player.nextDirY = 0;
              }
            }
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
        alpha: 0.9,
        duration: 380,
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
  // PLAYER GRID MOVEMENT (GENUINE PAC-MAN)
  // ==========================================
  #updatePlayer() {
    const p = this.#player;

    p.prevCol = p.col;
    p.prevRow = p.row;

    // 1. Immediate 180-degree reversal check
    if (p.nextDirX === -p.dirX && p.nextDirY === -p.dirY && (p.dirX !== 0 || p.dirY !== 0)) {
      p.dirX = p.nextDirX;
      p.dirY = p.nextDirY;
      p.nextDirX = 0;
      p.nextDirY = 0;
    }

    // 2. If stopped, start moving if queued direction is walkable
    if (p.dirX === 0 && p.dirY === 0) {
      if ((p.nextDirX !== 0 || p.nextDirY !== 0) && this.#canMove(p.col + p.nextDirX, p.row + p.nextDirY, false)) {
        p.dirX = p.nextDirX;
        p.dirY = p.nextDirY;
        p.nextDirX = 0;
        p.nextDirY = 0;
      }
    }

    // 3. Step motion
    if (p.dirX !== 0) {
      p.y = this.#getTileCenterY(p.row);

      const targetCol = p.dirX > 0 ? p.col + 1 : p.col - 1;
      const targetX = this.#getTileCenterX(targetCol);

      // Tunnel wrap on VAULT_WRAP_ROW
      if (p.row === VAULT_WRAP_ROW) {
        if (p.dirX < 0 && p.x < VAULT_OFFSET_X) {
          p.col = VAULT_MAZE_COLS - 1;
          p.x = this.#getTileCenterX(p.col);
          this.#catSprite.setPosition(p.x, p.y);
          return;
        } else if (p.dirX > 0 && p.x > VAULT_OFFSET_X + VAULT_MAZE_COLS * VAULT_TILE_SIZE) {
          p.col = 0;
          p.x = this.#getTileCenterX(p.col);
          this.#catSprite.setPosition(p.x, p.y);
          return;
        }
      }

      const dist = Math.abs(targetX - p.x);
      if (p.speed >= dist) {
        p.x = targetX;
        p.col = targetCol;
        const leftover = p.speed - dist;

        if (p.row === VAULT_WRAP_ROW && (p.col < 0 || p.col >= VAULT_MAZE_COLS)) {
          p.col = p.col < 0 ? VAULT_MAZE_COLS - 1 : 0;
          p.x = this.#getTileCenterX(p.col);
        }

        this.#checkPelletCollection(p.col, p.row);

        // Turn check at tile center
        if ((p.nextDirX !== 0 || p.nextDirY !== 0) && this.#canMove(p.col + p.nextDirX, p.row + p.nextDirY, false)) {
          p.dirX = p.nextDirX;
          p.dirY = p.nextDirY;
          p.nextDirX = 0;
          p.nextDirY = 0;
        } else if (!this.#canMove(p.col + p.dirX, p.row + p.dirY, false)) {
          p.dirX = 0;
          p.dirY = 0;
        }

        p.x += p.dirX * leftover;
        p.y += p.dirY * leftover;
      } else {
        p.x += p.dirX * p.speed;
      }
    } else if (p.dirY !== 0) {
      p.x = this.#getTileCenterX(p.col);

      const targetRow = p.dirY > 0 ? p.row + 1 : p.row - 1;
      const targetY = this.#getTileCenterY(targetRow);

      const dist = Math.abs(targetY - p.y);
      if (p.speed >= dist) {
        p.y = targetY;
        p.row = targetRow;
        const leftover = p.speed - dist;

        this.#checkPelletCollection(p.col, p.row);

        // Turn check at tile center
        if ((p.nextDirX !== 0 || p.nextDirY !== 0) && this.#canMove(p.col + p.nextDirX, p.row + p.nextDirY, false)) {
          p.dirX = p.nextDirX;
          p.dirY = p.nextDirY;
          p.nextDirX = 0;
          p.nextDirY = 0;
        } else if (!this.#canMove(p.col + p.dirX, p.row + p.dirY, false)) {
          p.dirX = 0;
          p.dirY = 0;
        }

        p.x += p.dirX * leftover;
        p.y += p.dirY * leftover;
      } else {
        p.y += p.dirY * p.speed;
      }
    }

    // 4. Update sprite transform
    this.#catSprite.setPosition(p.x, p.y);
    if (p.dirX < 0) {
      this.#catSprite.setFlipX(true);
    } else if (p.dirX > 0) {
      this.#catSprite.setFlipX(false);
    }
  }

  #canMove(col, row, isApe = false) {
    if (row === VAULT_WRAP_ROW && (col < 0 || col >= VAULT_MAZE_COLS)) return true;
    if (col < 0 || col >= VAULT_MAZE_COLS || row < 0 || row >= VAULT_MAZE_ROWS) return false;

    const char = VAULT_MAZE_GRID[row][col];
    if (char === '#') return false;

    // Vault door '-' is never passable by player
    if (char === '-' && !isApe) return false;

    // Ghost house 'V' is never passable by player
    if (char === 'V' && !isApe) return false;

    // Active apes outside the vault cannot re-enter through door '-'
    if (char === '-' && isApe) return false;

    return true;
  }

  #checkPelletCollection(col, row) {
    for (let i = this.#pellets.length - 1; i >= 0; i--) {
      const pellet = this.#pellets[i];
      if (pellet.col === col && pellet.row === row) {
        pellet.sprite.destroy();
        this.#pellets.splice(i, 1);
        this.#pelletsLeft--;

        if (pellet.isBig) {
          // Big Corner Coin: +50 score & trigger Frightened Mode
          this.#miniScore += VAULT_POWER_COIN_VALUE;
          runState.addScore(VAULT_POWER_COIN_VALUE);
          this.#showFloatingText(pellet.x, pellet.y - 10, `+${VAULT_POWER_COIN_VALUE} OVERCLOCK!`, '#FFD700');
          this.#startFrightenedMode();
        } else {
          // Regular "B" Pellet: +10 score
          this.#miniScore += VAULT_PELLET_VALUE;
          runState.addScore(VAULT_PELLET_VALUE);
        }

        this.#updateHUD();

        // Win condition: All pellets collected
        if (this.#pelletsLeft <= 0) {
          this.#triggerVictory();
          return;
        }
        break;
      }
    }
  }

  // ==========================================
  // FRIGHTENED MODE (VULNERABLE APES)
  // ==========================================
  #startFrightenedMode() {
    this.#isFrightened = true;
    this.#frightenedTimer = VAULT_FRIGHTENED_DURATION_MS;

    // Tint apes neon blue, reverse direction, reduce speed
    this.#apes.forEach((ape) => {
      ape.sprite.setTint(0x00B0FF);
      ape.speed = VAULT_APE_FRIGHTENED_SPEED;
      // Immediate 180 reverse on mode trigger
      if (ape.state === 'active') {
        ape.dirX = -ape.dirX;
        ape.dirY = -ape.dirY;
      }
    });
  }

  #endFrightenedMode() {
    this.#isFrightened = false;
    this.#frightenedTimer = 0;

    this.#apes.forEach((ape) => {
      ape.sprite.clearTint();
      ape.speed = VAULT_APE_NORMAL_SPEED;
    });
  }

  // ==========================================
  // APES (GHOSTS) AI & MOVEMENT
  // ==========================================
  #updateApes(delta) {
    const doorX = VAULT_OFFSET_X + 13.5 * VAULT_TILE_SIZE; // 504
    const doorExitY = this.#getTileCenterY(8); // 236

    this.#apes.forEach((ape) => {
      ape.prevCol = ape.col;
      ape.prevRow = ape.row;

      // 1. IN HOUSE
      if (ape.state === 'house') {
        if (this.#gameplayElapsedMs >= ape.releaseDelayMs) {
          ape.state = 'exiting';
        } else {
          const bobY = Math.sin(this.#gameplayElapsedMs * 0.006 + ape.id) * 3;
          ape.sprite.setY(this.#getTileCenterY(ape.homeRow) + bobY);
          return;
        }
      }

      // 2. EXITING HOUSE (moves to door center, then straight up through laser gate)
      if (ape.state === 'exiting') {
        if (Math.abs(ape.x - doorX) > 1.5) {
          ape.x += (ape.x < doorX ? 1 : -1) * ape.speed;
        } else {
          ape.x = doorX;
          ape.y -= ape.speed;
          if (ape.y <= doorExitY) {
            ape.y = doorExitY;
            ape.col = (ape.id % 2 === 0) ? 14 : 13;
            ape.row = 8;
            ape.dirX = (ape.id % 2 === 0) ? 1 : -1;
            ape.dirY = 0;
            ape.state = 'active';
            ape.isReleased = true;
          }
        }
        ape.sprite.setPosition(ape.x, ape.y);
        return;
      }

      // 3. ACTIVE MAZE MOVEMENT
      if (ape.dirX !== 0) {
        ape.y = this.#getTileCenterY(ape.row);

        const targetCol = ape.dirX > 0 ? ape.col + 1 : ape.col - 1;
        const targetX = this.#getTileCenterX(targetCol);

        // Tunnel wrap check on row 10
        if (ape.row === VAULT_WRAP_ROW) {
          if (ape.dirX < 0 && ape.x < VAULT_OFFSET_X) {
            ape.col = VAULT_MAZE_COLS - 1;
            ape.x = this.#getTileCenterX(ape.col);
            ape.sprite.setPosition(ape.x, ape.y);
            return;
          } else if (ape.dirX > 0 && ape.x > VAULT_OFFSET_X + VAULT_MAZE_COLS * VAULT_TILE_SIZE) {
            ape.col = 0;
            ape.x = this.#getTileCenterX(ape.col);
            ape.sprite.setPosition(ape.x, ape.y);
            return;
          }
        }

        const dist = Math.abs(targetX - ape.x);
        if (ape.speed >= dist) {
          ape.x = targetX;
          ape.col = targetCol;
          const leftover = ape.speed - dist;

          if (ape.row === VAULT_WRAP_ROW && (ape.col < 0 || ape.col >= VAULT_MAZE_COLS)) {
            ape.col = ape.col < 0 ? VAULT_MAZE_COLS - 1 : 0;
            ape.x = this.#getTileCenterX(ape.col);
          }

          // Arrived at tile center: choose next direction
          this.#chooseNextApeDirection(ape);

          ape.x += ape.dirX * leftover;
          ape.y += ape.dirY * leftover;
        } else {
          ape.x += ape.dirX * ape.speed;
        }
      } else if (ape.dirY !== 0) {
        ape.x = this.#getTileCenterX(ape.col);

        const targetRow = ape.dirY > 0 ? ape.row + 1 : ape.row - 1;
        const targetY = this.#getTileCenterY(targetRow);

        const dist = Math.abs(targetY - ape.y);
        if (ape.speed >= dist) {
          ape.y = targetY;
          ape.row = targetRow;
          const leftover = ape.speed - dist;

          // Arrived at tile center: choose next direction
          this.#chooseNextApeDirection(ape);

          ape.x += ape.dirX * leftover;
          ape.y += ape.dirY * leftover;
        } else {
          ape.y += ape.dirY * ape.speed;
        }
      }

      ape.sprite.setPosition(ape.x, ape.y);
      if (ape.dirX < 0) {
        ape.sprite.setFlipX(true);
      } else if (ape.dirX > 0) {
        ape.sprite.setFlipX(false);
      }
    });
  }

  #chooseNextApeDirection(ape) {
    const candidateDirs = [
      { x: 0, y: -1 }, // Up
      { x: -1, y: 0 }, // Left
      { x: 0, y: 1 },  // Down
      { x: 1, y: 0 },  // Right
    ];

    // Filter out 180-degree reverse (ghosts never reverse at intersections)
    const nonReverse = candidateDirs.filter(
      (d) => !(d.x === -ape.dirX && d.y === -ape.dirY) && this.#canMove(ape.col + d.x, ape.row + d.y, true)
    );

    let valid = nonReverse;
    if (valid.length === 0) {
      // Dead-end: fallback to reversing
      valid = candidateDirs.filter((d) => this.#canMove(ape.col + d.x, ape.row + d.y, true));
    }

    if (valid.length === 0) return;

    if (this.#isFrightened) {
      // Frightened mode: random wander
      const chosen = Phaser.Utils.Array.GetRandom(valid);
      ape.dirX = chosen.x;
      ape.dirY = chosen.y;
      return;
    }

    // Normal mode: personality targeting
    const pCol = this.#player.col;
    const pRow = this.#player.row;
    const pDirX = this.#player.dirX;
    const pDirY = this.#player.dirY;
    const blinky = this.#apes.find((a) => a.personality === 'blinky') || this.#apes[0];

    let targetTile = { col: pCol, row: pRow };

    switch (ape.personality) {
      case 'blinky':
        // BLINKY (Shadow Ape): Direct chaser targeting player's exact tile
        targetTile = { col: pCol, row: pRow };
        break;

      case 'pinky':
        // PINKY (Cyber Ape): Ambusher targeting 4 tiles ahead of player
        targetTile = {
          col: pCol + (pDirX !== 0 ? pDirX * 4 : 0),
          row: pRow + (pDirY !== 0 ? pDirY * 4 : 0),
        };
        break;

      case 'inky':
        // INKY (Rogue Ape): Flanker vectoring off Blinky and player
        {
          const pivotCol = pCol + pDirX * 2;
          const pivotRow = pRow + pDirY * 2;
          targetTile = {
            col: blinky.col + (pivotCol - blinky.col) * 2,
            row: blinky.row + (pivotRow - blinky.row) * 2,
          };
        }
        break;

      case 'clyde':
        // CLYDE (Glitch Ape): Chases if far (> 8 tiles), retreats to corner if close
        {
          const distSq = (ape.col - pCol) * (ape.col - pCol) + (ape.row - pRow) * (ape.row - pRow);
          if (distSq > 64) {
            targetTile = { col: pCol, row: pRow };
          } else {
            targetTile = ape.scatterTarget || { col: 0, row: 21 };
          }
        }
        break;

      default:
        targetTile = { col: pCol, row: pRow };
        break;
    }

    // Pick candidate direction minimizing Euclidean distance squared to targetTile
    let minDist = Infinity;
    let bestDir = valid[0];
    for (const d of valid) {
      const nc = ape.col + d.x;
      const nr = ape.row + d.y;
      const dist = (nc - targetTile.col) * (nc - targetTile.col) + (nr - targetTile.row) * (nr - targetTile.row);
      if (dist < minDist) {
        minDist = dist;
        bestDir = d;
      }
    }

    ape.dirX = bestDir.x;
    ape.dirY = bestDir.y;
  }

  // ==========================================
  // APE COLLISION RESOLUTION
  // ==========================================
  #checkApeCollisions() {
    if (this.#player.isInvulnerable) return;

    const px = this.#player.x;
    const py = this.#player.y;
    const pCol = this.#player.col;
    const pRow = this.#player.row;

    for (let i = 0; i < this.#apes.length; i++) {
      const ape = this.#apes[i];
      if (ape.state !== 'active') continue;

      const dist = Phaser.Math.Distance.Between(px, py, ape.x, ape.y);
      const isCollision = dist < 13 || (pCol === ape.col && pRow === ape.row);

      if (isCollision) {
        if (this.#isFrightened) {
          // Eat vulnerable ape (+200 BIT)
          this.#miniScore += VAULT_APE_EAT_VALUE;
          runState.addScore(VAULT_APE_EAT_VALUE);
          this.#showFloatingText(ape.x, ape.y - 12, `+${VAULT_APE_EAT_VALUE} BUSTED!`, '#00FF66');
          this.#updateHUD();

          // Respawn ape back inside vault house
          ape.state = 'house';
          ape.isReleased = false;
          ape.releaseDelayMs = this.#gameplayElapsedMs + 5000;
          ape.col = ape.homeCol;
          ape.row = ape.homeRow;
          ape.x = this.#getTileCenterX(ape.homeCol);
          ape.y = this.#getTileCenterY(ape.homeRow);
          ape.dirX = 0;
          ape.dirY = -1;
          ape.sprite.setPosition(ape.x, ape.y);
          ape.sprite.clearTint();
          ape.speed = VAULT_APE_NORMAL_SPEED;
        } else {
          // Caught by normal ape: lose 1 life and prompt continue/exit
          this.#handlePlayerHit();
          return;
        }
      }
    }
  }

  #handlePlayerHit() {
    this.cameras.main.shake(300, 0.02);
    runState.loseLife();

    if (runState.lives <= 0) {
      this.#triggerDefeat(SESSION_END_REASONS.DEFEAT, 'SECURITY BREACH: ALL UNITS COMPROMISED');
      return;
    }

    // Ask player if they want to continue or abort to avoid exhausting all 3 lives
    this.#showDeathModal();
  }

  // ==========================================
  // INTERACTIVE MODALS (DEATH CONTINUE & ESC EXIT)
  // ==========================================
  #showDeathModal() {
    this.#isPlaying = false;
    TimeManager.pause();
    this.#activeModalType = 'death';
    this.#modalSelectedIndex = 0;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.#modalContainer = this.add.container(0, 0).setDepth(200);

    // Fullscreen dark overlay
    const backdrop = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05020d, 0.8)
      .setInteractive();
    this.#modalContainer.add(backdrop);

    // Dialog card
    const cardW = 540;
    const cardH = 260;
    const card = this.add.rectangle(cx, cy, cardW, cardH, 0x0a051d, 0.98)
      .setStrokeStyle(2, 0xFF0055, 0.95);
    const innerBorder = this.add.rectangle(cx, cy, cardW - 8, cardH - 8, 0x000000, 0)
      .setStrokeStyle(1, 0x00E5FF, 0.5);
    this.#modalContainer.add([card, innerBorder]);

    // Header badge
    const header = this.add.text(cx, cy - 95, '// OPERATIVE COMPROMISED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Title
    const title = this.add.text(cx, cy - 65, 'HACKER DAEMON INTERCEPTION', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '20px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Lives counter
    const hearts = '♥ '.repeat(Math.max(0, runState.lives)).trim();
    const livesText = this.add.text(cx, cy - 35, `SYSTEM INTEGRITY: ${hearts} (${runState.lives}/3 LIVES LEFT)`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Prompt
    const prompt = this.add.text(cx, cy - 5, 'DO YOU WANT TO CONTINUE INFILTRATION?', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#00E5FF',
    }).setOrigin(0.5);

    this.#modalContainer.add([header, title, livesText, prompt]);

    // Buttons: YES (0) and NO (1)
    const btnW = 200;
    const btnH = 42;
    const btnY = cy + 45;

    const yesX = cx - 115;
    const noX = cx + 115;

    const yesBg = this.add.rectangle(yesX, btnY, btnW, btnH, 0x00E5FF, 1)
      .setStrokeStyle(2, 0xFFFFFF, 0.8)
      .setInteractive({ useHandCursor: true });
    const yesTxt = this.add.text(yesX, btnY, '► YES - RESPAWN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#05020d',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const noBg = this.add.rectangle(noX, btnY, btnW, btnH, 0x120a2e, 1)
      .setStrokeStyle(1, 0x554d77, 0.8)
      .setInteractive({ useHandCursor: true });
    const noTxt = this.add.text(noX, btnY, 'NO - ABORT RUN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#8E8AAB',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    yesBg.on('pointerdown', () => { this.#selectModalOption(0); this.#confirmModalSelection(); });
    yesBg.on('pointerover', () => this.#selectModalOption(0));

    noBg.on('pointerdown', () => { this.#selectModalOption(1); this.#confirmModalSelection(); });
    noBg.on('pointerover', () => this.#selectModalOption(1));

    this.#modalButtonBgs = [yesBg, noBg];
    this.#modalButtonTexts = [yesTxt, noTxt];
    this.#modalContainer.add([yesBg, yesTxt, noBg, noTxt]);

    // Hint footer
    const hint = this.add.text(cx, cy + 98, '[ARROWS / WASD] SELECT   •   [ENTER / SPACE] CONFIRM', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '10px',
      color: '#776E99',
    }).setOrigin(0.5);
    this.#modalContainer.add(hint);

    this.#updateModalSelection();
  }

  #showExitModal() {
    if (this.#isGameOver || this.#hasWon) return;

    this.#isPlaying = false;
    TimeManager.pause();
    this.#activeModalType = 'exit';
    this.#modalSelectedIndex = 0;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.#modalContainer = this.add.container(0, 0).setDepth(200);

    // Fullscreen dark overlay
    const backdrop = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05020d, 0.8)
      .setInteractive();
    this.#modalContainer.add(backdrop);

    // Dialog card
    const cardW = 540;
    const cardH = 260;
    const card = this.add.rectangle(cx, cy, cardW, cardH, 0x0a051d, 0.98)
      .setStrokeStyle(2, 0x00E5FF, 0.95);
    const innerBorder = this.add.rectangle(cx, cy, cardW - 8, cardH - 8, 0x000000, 0)
      .setStrokeStyle(1, 0xFF00FF, 0.5);
    this.#modalContainer.add([card, innerBorder]);

    // Header badge
    const header = this.add.text(cx, cy - 95, '// MISSION PROTOCOL PAUSED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Title
    const title = this.add.text(cx, cy - 65, 'ABORT VAULT RUN?', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '22px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Explanation
    const desc = this.add.text(cx, cy - 35, 'DO YOU WANT TO EXIT AND RETURN TO OVERWORLD?', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // Warning
    const warn = this.add.text(cx, cy - 5, 'TIME SPENT WILL BE DEDUCTED FROM OVERWORLD TIMELINE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#FF00FF',
    }).setOrigin(0.5);

    this.#modalContainer.add([header, title, desc, warn]);

    // Buttons: RESUME (0) and ABORT (1)
    const btnW = 200;
    const btnH = 42;
    const btnY = cy + 45;

    const resumeX = cx - 115;
    const abortX = cx + 115;

    const resumeBg = this.add.rectangle(resumeX, btnY, btnW, btnH, 0x00E5FF, 1)
      .setStrokeStyle(2, 0xFFFFFF, 0.8)
      .setInteractive({ useHandCursor: true });
    const resumeTxt = this.add.text(resumeX, btnY, '► RESUME RUN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#05020d',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const abortBg = this.add.rectangle(abortX, btnY, btnW, btnH, 0x120a2e, 1)
      .setStrokeStyle(1, 0x554d77, 0.8)
      .setInteractive({ useHandCursor: true });
    const abortTxt = this.add.text(abortX, btnY, 'ABORT & EXIT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#8E8AAB',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    resumeBg.on('pointerdown', () => { this.#selectModalOption(0); this.#confirmModalSelection(); });
    resumeBg.on('pointerover', () => this.#selectModalOption(0));

    abortBg.on('pointerdown', () => { this.#selectModalOption(1); this.#confirmModalSelection(); });
    abortBg.on('pointerover', () => this.#selectModalOption(1));

    this.#modalButtonBgs = [resumeBg, abortBg];
    this.#modalButtonTexts = [resumeTxt, abortTxt];
    this.#modalContainer.add([resumeBg, resumeTxt, abortBg, abortTxt]);

    // Hint footer
    const hint = this.add.text(cx, cy + 98, '[ARROWS / WASD] SELECT   •   [ENTER] CONFIRM   •   [ESC] RESUME', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '10px',
      color: '#776E99',
    }).setOrigin(0.5);
    this.#modalContainer.add(hint);

    this.#updateModalSelection();
  }

  #selectModalOption(index) {
    if (!this.#activeModalType) return;
    this.#modalSelectedIndex = index;
    this.#updateModalSelection();
  }

  #updateModalSelection() {
    if (!this.#modalButtonBgs || this.#modalButtonBgs.length < 2) return;

    const isOption0 = this.#modalSelectedIndex === 0;

    // Option 0
    this.#modalButtonBgs[0].setFillStyle(isOption0 ? 0x00E5FF : 0x120a2e, 1);
    this.#modalButtonBgs[0].setStrokeStyle(isOption0 ? 2 : 1, isOption0 ? 0xFFFFFF : 0x554d77, 0.85);
    const rawTxt0 = this.#activeModalType === 'death' ? 'YES - RESPAWN' : 'RESUME RUN';
    this.#modalButtonTexts[0].setText(isOption0 ? `► ${rawTxt0}` : rawTxt0);
    this.#modalButtonTexts[0].setColor(isOption0 ? '#05020d' : '#8E8AAB');

    // Option 1
    const opt1Color = this.#activeModalType === 'death' ? 0xFF0055 : 0xFF00FF;
    const opt1TextColor = this.#activeModalType === 'death' ? '#FF6688' : '#FF66FF';
    this.#modalButtonBgs[1].setFillStyle(!isOption0 ? opt1Color : 0x120a2e, 1);
    this.#modalButtonBgs[1].setStrokeStyle(!isOption0 ? 2 : 1, !isOption0 ? 0xFFFFFF : 0x554d77, 0.85);
    const rawTxt1 = this.#activeModalType === 'death' ? 'NO - ABORT RUN' : 'ABORT & EXIT';
    this.#modalButtonTexts[1].setText(!isOption0 ? `► ${rawTxt1}` : rawTxt1);
    this.#modalButtonTexts[1].setColor(!isOption0 ? '#FFFFFF' : opt1TextColor);
  }

  #closeModal() {
    if (this.#modalContainer) {
      this.#modalContainer.destroy();
      this.#modalContainer = null;
    }
    this.#activeModalType = null;
    this.#modalButtonBgs = [];
    this.#modalButtonTexts = [];
  }

  #confirmModalSelection() {
    if (!this.#activeModalType) return;

    const type = this.#activeModalType;
    const choice = this.#modalSelectedIndex;
    this.#closeModal();

    if (type === 'death') {
      if (choice === 0) {
        // YES - Continue / Respawn
        this.#resetPlayerPosition();
        this.#player.isInvulnerable = true;
        this.#player.invulnerableTimer = VAULT_INVULNERABILITY_MS;

        // Reset all apes to house
        this.#apes.forEach((ape, idx) => {
          ape.state = 'house';
          ape.isReleased = false;
          ape.releaseDelayMs = this.#gameplayElapsedMs + (idx === 0 ? 500 : idx * 3000);
          ape.col = ape.homeCol;
          ape.row = ape.homeRow;
          ape.x = this.#getTileCenterX(ape.homeCol);
          ape.y = this.#getTileCenterY(ape.homeRow);
          ape.dirX = 0;
          ape.dirY = -1;
          ape.sprite.setPosition(ape.x, ape.y);
          ape.sprite.clearTint();
          ape.speed = VAULT_APE_NORMAL_SPEED;
        });

        TimeManager.resume();
        this.#isPlaying = true;
        this.#showFloatingText(this.#player.x, this.#player.y - 20, 'SYSTEM RESTORED! GOOD LUCK', '#00FF66');
      } else {
        // NO - Abort run
        this.#triggerDefeat(SESSION_END_REASONS.PLAYER_QUIT, 'OPERATIVE INFILTRATION ABORTED');
      }
    } else if (type === 'exit') {
      if (choice === 0) {
        // RESUME
        TimeManager.resume();
        this.#isPlaying = true;
      } else {
        // ABORT & EXIT
        this.#triggerDefeat(SESSION_END_REASONS.PLAYER_QUIT, 'MISSION ABORTED BY OPERATIVE');
      }
    }
  }

  // ==========================================
  // NEON STREAM TRAIL
  // ==========================================
  #updateTrail() {
    if (!this.#catTrailGraphics?.scene) return;
    this.#catTrailGraphics.clear();

    if (this.#catSprite?.scene && (this.#player.dirX !== 0 || this.#player.dirY !== 0)) {
      this.#catTrail.push({
        x: this.#player.x - this.#player.dirX * 8,
        y: this.#player.y - this.#player.dirY * 8,
        alpha: 0.9,
      });
    }

    for (let i = this.#catTrail.length - 1; i >= 0; i--) {
      const pt = this.#catTrail[i];
      pt.alpha -= 0.05;

      if (pt.alpha <= 0) {
        this.#catTrail.splice(i, 1);
        continue;
      }

      this.#catTrailGraphics.fillStyle(0x00E5FF, pt.alpha);
      this.#catTrailGraphics.fillCircle(pt.x, pt.y, 3);
      this.#catTrailGraphics.fillStyle(0xFFFFFF, pt.alpha * 0.8);
      this.#catTrailGraphics.fillCircle(pt.x, pt.y, 1.5);
    }
  }

  #showFloatingText(x, y, message, color = '#00FF66') {
    const txt = this.add.text(x, y, message, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

    this.tweens.add({
      targets: txt,
      y: y - 28,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ==========================================
  // F1 DEBUG OVERLAY
  // ==========================================
  #renderDebugOverlay() {
    if (!this.#debugGraphics) return;
    this.#debugGraphics.clear();

    // 1. Grid outlines
    for (let r = 0; r < VAULT_MAZE_ROWS; r++) {
      for (let c = 0; c < VAULT_MAZE_COLS; c++) {
        const x = VAULT_OFFSET_X + c * VAULT_TILE_SIZE;
        const y = VAULT_OFFSET_Y + r * VAULT_TILE_SIZE;
        const ch = VAULT_MAZE_GRID[r][c];

        if (ch === '#') {
          this.#debugGraphics.fillStyle(0xFF0055, 0.25);
          this.#debugGraphics.fillRect(x, y, VAULT_TILE_SIZE, VAULT_TILE_SIZE);
        } else if (ch === '-') {
          this.#debugGraphics.fillStyle(0x00E5FF, 0.4);
          this.#debugGraphics.fillRect(x, y, VAULT_TILE_SIZE, VAULT_TILE_SIZE);
        } else {
          this.#debugGraphics.lineStyle(0.5, 0x334466, 0.3);
          this.#debugGraphics.strokeRect(x, y, VAULT_TILE_SIZE, VAULT_TILE_SIZE);
        }
      }
    }

    // 2. Player spawn marker
    const sx = VAULT_OFFSET_X + VAULT_PLAYER_SPAWN.col * VAULT_TILE_SIZE;
    const sy = VAULT_OFFSET_Y + VAULT_PLAYER_SPAWN.row * VAULT_TILE_SIZE;
    this.#debugGraphics.lineStyle(2, 0x00FF66, 1);
    this.#debugGraphics.strokeRect(sx, sy, VAULT_TILE_SIZE, VAULT_TILE_SIZE);

    // 3. Player current tile marker
    const px = VAULT_OFFSET_X + this.#player.col * VAULT_TILE_SIZE;
    const py = VAULT_OFFSET_Y + this.#player.row * VAULT_TILE_SIZE;
    this.#debugGraphics.lineStyle(1.5, 0xFFFF00, 1);
    this.#debugGraphics.strokeRect(px, py, VAULT_TILE_SIZE, VAULT_TILE_SIZE);
  }

  // ==========================================
  // WIN & DEFEAT OUTCOMES
  // ==========================================
  #triggerVictory() {
    if (this.#hasWon || this.#isGameOver) return;
    this.#hasWon = true;
    this.#isPlaying = false;
    this.#closeModal();

    // End session with TimeManager
    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, SESSION_END_REASONS.WIN);
    }

    // Report idempotent game result to ScoreManager
    ScoreManager.reportGameResult('vaultRun', {
      score: this.#miniScore,
      completed: true,
      durationMs: this.#gameplayElapsedMs,
      runId: runState.runStart,
      portalId: 2,
    });

    this.cameras.main.flash(350, 0, 255, 100);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 640, 160, 0x072818, 0.96)
      .setStrokeStyle(3, 0x00FF66, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// VAULT PROTOCOL SUCCESS //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'VAULT SECURED!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '36px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, 'ALL LEDGER BLOCKS DRAINED • RETURNING TO BATTLE PROTOCOL...', {
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

  /**
   * @param {string} [reasonKey]
   * @param {string} [reasonMsg]
   */
  #triggerDefeat(reasonKey = SESSION_END_REASONS.DEFEAT, reasonMsg = 'SECURITY BREACH') {
    if (this.#isGameOver || this.#hasWon) return;
    this.#isGameOver = true;
    this.#isPlaying = false;
    this.#closeModal();

    // End session with TimeManager
    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, reasonKey);
    }

    // Report result
    ScoreManager.reportGameResult('vaultRun', {
      score: this.#miniScore,
      completed: false,
      durationMs: this.#gameplayElapsedMs,
      runId: runState.runStart,
      portalId: 2,
    });

    this.cameras.main.shake(400, 0.025);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 640, 160, 0x2e0617, 0.96)
      .setStrokeStyle(3, 0xFF0055, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// EXCEPTION: VAULT SECURITY //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FF6688',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'VAULT LOCKDOWN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '38px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, `${reasonMsg}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FFC0D0',
    }).setOrigin(0.5).setDepth(151);

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // If player chose to abort/quit, return directly to world scene
        if (reasonKey === SESSION_END_REASONS.PLAYER_QUIT) {
          this.scene.start(SCENE_KEYS.WORLD_SCENE);
        } else {
          this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
            ...this._data,
            mode: 'lose',
          });
        }
      });
    });
  }

  // ==========================================
  // DEBUG / TESTING METHODS
  // ==========================================
  getPelletsLeft() {
    return this.#pelletsLeft;
  }

  getPlayerState() {
    return { ...this.#player };
  }

  getActiveModal() {
    return {
      type: this.#activeModalType,
      selectedIndex: this.#modalSelectedIndex,
    };
  }

  simulateHitDebug() {
    this.#handlePlayerHit();
  }

  simulateEscDebug() {
    this.#showExitModal();
  }

  getApes() {
    return this.#apes.map(a => ({
      id: a.id,
      name: a.name,
      x: a.x,
      y: a.y,
      col: a.col,
      row: a.row,
      state: a.state,
      isReleased: a.isReleased,
    }));
  }

  triggerFrightenedDebug() {
    this.#startFrightenedMode();
  }

  eatAllPelletsDebug() {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
    this.#pellets.forEach((p) => p.sprite.destroy());
    this.#pellets = [];
    this.#pelletsLeft = 0;
    this.#miniScore += 500;
    runState.addScore(500);
    this.#updateHUD();
    this.#triggerVictory();
  }
}
