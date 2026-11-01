import Phaser from '../../lib/phaser.js';
import { BaseScene } from '../base-scene.js';
import { SCENE_KEYS } from '../scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../../assets/font-keys.js';
import { dataManager } from '../../utils/data-manager.js';
import { runState } from '../../state/run-state.js';
import { TimeManager, SESSION_END_REASONS } from '../../systems/time-manager.js';

const GRID_COLS = 28;
const GRID_ROWS = 15;
const CELL_SIZE = 32;
const OFFSET_X = 64; // (1024 - 28 * 32) / 2
const OFFSET_Y = 80; // (576 - 15 * 32) / 2 + 16 (below top HUD)

const TOTAL_TIME = 90; // 1:30 in seconds
const WIN_BLOCKS = 15;

export class ChainSnakeScene extends BaseScene {
  /** @type {object} */
  _data = {};

  /** @type {Array<{col: number, row: number}>} */
  #body = [];

  /** @type {{x: number, y: number}} */
  #direction = { x: 1, y: 0 };

  /** @type {{x: number, y: number}} */
  #nextDirection = { x: 1, y: 0 };

  /** @type {{col: number, row: number} | null} */
  #packet = null;

  /** @type {{col: number, row: number, expiresAt: number} | null} */
  #goldCoin = null;

  /** @type {{col: number, row: number} | null} */
  #malware = null;

  /** @type {number} */
  #malwareMoveTimer = 0;

  /** @type {number} */
  #blocksCollected = 0;

  /** @type {number} */
  #miniScore = 0;

  /** @type {number} */
  #timeLeft = TOTAL_TIME;

  /** @type {number} */
  #tickInterval = 160;

  /** @type {number} */
  #lastTickTime = 0;

  /** @type {boolean} */
  #isPlaying = false;

  /** @type {boolean} */
  #isGameOver = false;

  /** @type {boolean} */
  #hasWon = false;

  // Visual Objects
  /** @type {Phaser.GameObjects.Graphics} */
  #gridGraphics;

  /** @type {Phaser.GameObjects.Graphics} */
  #snakeGraphics;

  /** @type {Phaser.GameObjects.Image} */
  #catHeadSprite;

  /** @type {Phaser.GameObjects.Container} */
  #packetContainer;

  /** @type {Phaser.GameObjects.Container} */
  #goldCoinContainer;

  /** @type {Phaser.GameObjects.Container} */
  #malwareContainer;

  // HUD Elements
  /** @type {Phaser.GameObjects.Text} */
  #blocksText;

  /** @type {Phaser.GameObjects.Graphics} */
  #blocksBarGraphics;

  /** @type {Phaser.GameObjects.Text} */
  #scoreText;

  /** @type {Phaser.GameObjects.Text} */
  #timerText;

  /** @type {Phaser.GameObjects.Text} */
  #worldTimerText;

  /** @type {Phaser.Time.TimerEvent | undefined} */
  #gameTimerEvent;

  /** @type {Phaser.Time.TimerEvent | undefined} */
  #goldCoinSpawnTimer;

  /** @type {string | null} */
  #sessionId = null;

  constructor() {
    super({ key: SCENE_KEYS.CHAIN_SNAKE_SCENE });
  }

  init(data) {
    super.init(data);
    this._data = data || {};
    this.#body = [];
    this.#direction = { x: 1, y: 0 };
    this.#nextDirection = { x: 1, y: 0 };
    this.#packet = null;
    this.#goldCoin = null;
    this.#malware = null;
    this.#malwareMoveTimer = 0;
    this.#blocksCollected = 0;
    this.#miniScore = 0;
    this.#tickInterval = 160;
    this.#lastTickTime = 0;
    this.#isPlaying = false;
    this.#isGameOver = false;
    this.#hasWon = false;
    this.#sessionId = null;
  }

  create() {
    super.create();
    this.cameras.main.setBackgroundColor('#070410');
    this.cameras.main.fadeIn(300);

    const session = TimeManager.beginSession('chainSnake');
    if (!session) {
      this.scene.start(SCENE_KEYS.WORLD_SCENE);
      return;
    }
    this.#sessionId = session.sessionId;

    // 1. Draw dark neon grid floor
    this.#drawNeonGridFloor();

    // 2. Initialize graphics for snake body and links
    this.#snakeGraphics = this.add.graphics().setDepth(10);

    // 3. Initialize Head (player cat sprite)
    const catChoice = runState.hunter || dataManager.getPlayerCat() || 'cat-1';
    const catKey = this.textures.exists(catChoice) ? catChoice : 'PLAYER';
    this.#catHeadSprite = this.add.image(0, 0, catKey)
      .setDepth(20)
      .setOrigin(0.5, 0.5);
    this.#catHeadSprite.setDisplaySize(28, 32);

    // Idle bob tween on cat head
    this.tweens.add({
      targets: this.#catHeadSprite,
      scaleY: { from: this.#catHeadSprite.scaleY, to: this.#catHeadSprite.scaleY * 1.08 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 4. Setup Containers for items
    this.#packetContainer = this.add.container(0, 0).setDepth(15);
    this.#goldCoinContainer = this.add.container(0, 0).setDepth(16).setVisible(false);
    this.#malwareContainer = this.add.container(0, 0).setDepth(18).setVisible(false);

    // 5. Initialize Snake body segments (head + 2 tail blocks)
    this.#body = [
      { col: 8, row: 7 },
      { col: 7, row: 7 },
      { col: 6, row: 7 },
    ];

    // 6. Spawn initial Transaction Packet
    this.#spawnPacket();

    // 7. Setup HUD Bar
    this.#createHUD();

    // 8. Setup Controls
    this.#setupControls();

    // 9. Initial Render of Snake
    this.#renderSnake();

    // 10. Start 3-2-1 Countdown
    this.#startCountdown();
  }

  update(time, delta) {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    const timeStatus = TimeManager.tick(delta);
    if (timeStatus.worldExpired) {
      this.#triggerDefeat('WORLD TIMELINE EXPIRED');
      return;
    }
    if (timeStatus.sessionExpired) {
      this.#triggerDefeat('TIMEOUT: CONSENSUS EXPIRED');
      return;
    }

    this.#updateTimerDisplay();

    if (time >= this.#lastTickTime + this.#tickInterval) {
      this.#lastTickTime = time;
      this.#stepSnake();
    }
  }

  // ==========================================
  // GRID FLOOR DRAWING
  // ==========================================
  #drawNeonGridFloor() {
    this.#gridGraphics = this.add.graphics().setDepth(1);

    // Outer grid backdrop fill
    this.#gridGraphics.fillStyle(0x0a0618, 0.85);
    this.#gridGraphics.fillRect(OFFSET_X, OFFSET_Y, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);

    // Grid lines
    this.#gridGraphics.lineStyle(1, 0x1b1338, 0.55);
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = OFFSET_X + c * CELL_SIZE;
      this.#gridGraphics.lineBetween(x, OFFSET_Y, x, OFFSET_Y + GRID_ROWS * CELL_SIZE);
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = OFFSET_Y + r * CELL_SIZE;
      this.#gridGraphics.lineBetween(OFFSET_X, y, OFFSET_X + GRID_COLS * CELL_SIZE, y);
    }

    // Outer neon glowing border
    this.#gridGraphics.lineStyle(2, 0x00E5FF, 0.85);
    this.#gridGraphics.strokeRect(OFFSET_X, OFFSET_Y, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);

    // Neon corner brackets
    const bracketSize = 12;
    this.#gridGraphics.lineStyle(3, 0xA855F7, 1);
    // Top-left
    this.#gridGraphics.lineBetween(OFFSET_X - 2, OFFSET_Y - 2, OFFSET_X + bracketSize, OFFSET_Y - 2);
    this.#gridGraphics.lineBetween(OFFSET_X - 2, OFFSET_Y - 2, OFFSET_X - 2, OFFSET_Y + bracketSize);
    // Top-right
    const rX = OFFSET_X + GRID_COLS * CELL_SIZE + 2;
    this.#gridGraphics.lineBetween(rX, OFFSET_Y - 2, rX - bracketSize, OFFSET_Y - 2);
    this.#gridGraphics.lineBetween(rX, OFFSET_Y - 2, rX, OFFSET_Y + bracketSize);
    // Bottom-left
    const bY = OFFSET_Y + GRID_ROWS * CELL_SIZE + 2;
    this.#gridGraphics.lineBetween(OFFSET_X - 2, bY, OFFSET_X + bracketSize, bY);
    this.#gridGraphics.lineBetween(OFFSET_X - 2, bY, OFFSET_X - 2, bY - bracketSize);
    // Bottom-right
    this.#gridGraphics.lineBetween(rX, bY, rX - bracketSize, bY);
    this.#gridGraphics.lineBetween(rX, bY, rX, bY - bracketSize);
  }

  // ==========================================
  // HUD CREATION & UPDATES
  // ==========================================
  #createHUD() {
    const hudY = 32;
    const width = this.scale.width;

    // HUD background bar
    this.add.rectangle(width / 2, hudY, width - 40, 52, 0x090518, 0.95)
      .setStrokeStyle(2, 0x00E5FF, 0.85)
      .setDepth(50);

    // Left: Game & District Info
    this.add.text(35, hudY - 14, '// CHAIN SNAKE // MEMPOOL DISTRICT //', {
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

    // Center: Blocks Counter & Progress
    this.#blocksText = this.add.text(width * 0.40, hudY - 10, `BLOCKS: 0/${WIN_BLOCKS}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Blocks Progress Bar
    this.#blocksBarGraphics = this.add.graphics().setDepth(51);
    this.#updateBlocksBar();

    // Right-Center: Score
    this.#scoreText = this.add.text(width * 0.68, hudY, `SCORE: ${this.#miniScore} BIT`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '17px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    // Right: Time Left (Dual timers)
    this.#timerText = this.add.text(width - 150, hudY, 'TIME: 01:30', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    this.#worldTimerText = this.add.text(width - 55, hudY, 'WORLD: --:--', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#8E8AAB',
    }).setOrigin(0.5, 0.5).setDepth(51);
  }

  #updateHUD() {
    this.#blocksText.setText(`BLOCKS: ${this.#blocksCollected}/${WIN_BLOCKS}`);
    this.#scoreText.setText(`SCORE: ${this.#miniScore} BIT`);
    this.#updateBlocksBar();
  }

  #updateBlocksBar() {
    this.#blocksBarGraphics.clear();
    const barW = 120;
    const barH = 8;
    const barX = this.scale.width * 0.40 - barW / 2;
    const barY = 32 + 10;

    // Track
    this.#blocksBarGraphics.fillStyle(0x130a2a, 1);
    this.#blocksBarGraphics.fillRect(barX, barY, barW, barH);
    this.#blocksBarGraphics.lineStyle(1, 0x00E5FF, 0.5);
    this.#blocksBarGraphics.strokeRect(barX, barY, barW, barH);

    // Fill
    const fillRatio = Math.min(1, this.#blocksCollected / WIN_BLOCKS);
    if (fillRatio > 0) {
      this.#blocksBarGraphics.fillStyle(0x00FF66, 1);
      this.#blocksBarGraphics.fillRect(barX + 1, barY + 1, (barW - 2) * fillRatio, barH - 2);
    }
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
  // CONTROLS & STEERING
  // ==========================================
  #setupControls() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    // Arrow keys
    keyboard.on('keydown-UP', () => this.#queueDirection(0, -1));
    keyboard.on('keydown-DOWN', () => this.#queueDirection(0, 1));
    keyboard.on('keydown-LEFT', () => this.#queueDirection(-1, 0));
    keyboard.on('keydown-RIGHT', () => this.#queueDirection(1, 0));

    // WASD
    keyboard.on('keydown-W', () => this.#queueDirection(0, -1));
    keyboard.on('keydown-S', () => this.#queueDirection(0, 1));
    keyboard.on('keydown-A', () => this.#queueDirection(-1, 0));
    keyboard.on('keydown-D', () => this.#queueDirection(1, 0));
  }

  #queueDirection(dx, dy) {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    // Prevent 180-degree instant reversal into current moving direction
    if (dx !== 0 && this.#direction.x !== 0) return;
    if (dy !== 0 && this.#direction.y !== 0) return;

    this.#nextDirection = { x: 0, y: 0 };
    this.#nextDirection.x = dx;
    this.#nextDirection.y = dy;
  }

  // ==========================================
  // 3-2-1 COUNTDOWN
  // ==========================================
  #startCountdown() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05020d, 0.75)
      .setDepth(100);

    const bannerText = this.add.text(cx, cy - 60, '// MEMPOOL PROTOCOL ENGAGING //', {
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
      { text: 'LINK CHAIN!', color: '#00FF66', scale: 1.2 },
    ];

    let currentStep = 0;

    const runStep = () => {
      if (currentStep >= steps.length) {
        // Countdown finished, launch game
        this.tweens.add({
          targets: [overlay, bannerText, countText],
          alpha: 0,
          duration: 250,
          onComplete: () => {
            overlay.destroy();
            bannerText.destroy();
            countText.destroy();
            this.#startGameplay();
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

  #startGameplay() {
    this.#isPlaying = true;
    this.#lastTickTime = this.time.now;

    // 1-second interval timer for 90s countdown
    this.#gameTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
        this.#timeLeft--;
        this.#updateTimerDisplay();

        if (this.#timeLeft <= 0) {
          this.#triggerDefeat('TIMEOUT: CONSENSUS EXPIRED');
        }
      },
    });

    // Gold Block-Reward coin spawner (every 14 seconds)
    this.#goldCoinSpawnTimer = this.time.addEvent({
      delay: 14000,
      loop: true,
      callback: () => {
        if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
        this.#spawnGoldCoin();
      },
    });
  }

  // ==========================================
  // SNAKE TICK & GAMEPLAY RESOLUTION
  // ==========================================
  #stepSnake() {
    this.#direction = { ...this.#nextDirection };

    const head = this.#body[0];
    const nextCol = head.col + this.#direction.x;
    const nextRow = head.row + this.#direction.y;

    // 1. Wall Collision Check
    if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) {
      this.#triggerDefeat('PERIMETER BREACH: WALL COLLISION');
      return;
    }

    // 2. Malware Collision Check
    if (this.#malware && this.#malware.col === nextCol && this.#malware.row === nextRow) {
      this.#triggerDefeat('MALWARE INFECTION: CORRUPTED DATA');
      return;
    }

    // 3. Self Tail Collision Check
    const isHittingTail = this.#body.some((segment, idx) => {
      // Ignore head
      if (idx === 0) return false;
      return segment.col === nextCol && segment.row === nextRow;
    });

    if (isHittingTail) {
      this.#triggerDefeat('INTEGRITY COLLAPSE: CHAIN COLLISION');
      return;
    }

    // Move Head
    const newHead = { col: nextCol, row: nextRow };
    this.#body.unshift(newHead);

    // 4. Check Transaction Packet Collection
    let didEatPacket = false;
    if (this.#packet && this.#packet.col === nextCol && this.#packet.row === nextRow) {
      didEatPacket = true;
      this.#handlePacketCollected(nextCol, nextRow);
    }

    // If packet was NOT eaten, remove tail segment so length remains steady
    if (!didEatPacket) {
      this.#body.pop();
    }

    // 5. Check Gold Coin Collection
    if (this.#goldCoin && this.#goldCoin.col === nextCol && this.#goldCoin.row === nextRow) {
      this.#handleGoldCoinCollected(nextCol, nextRow);
    }

    // 6. Malware Movement (moves every 2 ticks once spawned)
    if (this.#malware) {
      this.#malwareMoveTimer++;
      if (this.#malwareMoveTimer % 2 === 0) {
        this.#stepMalware();
      }
    }

    // Render updated snake
    this.#renderSnake();
  }

  // ==========================================
  // ITEM HANDLING (PACKET, GOLD COIN, MALWARE)
  // ==========================================
  #spawnPacket() {
    const freeCell = this.#getRandomFreeCell();
    this.#packet = freeCell;

    const px = OFFSET_X + freeCell.col * CELL_SIZE + CELL_SIZE / 2;
    const py = OFFSET_Y + freeCell.row * CELL_SIZE + CELL_SIZE / 2;

    this.#packetContainer.removeAll(true);
    this.#packetContainer.setPosition(px, py);

    // Outer glow square
    const glow = this.add.rectangle(0, 0, 22, 22, 0x00FF66, 0.4)
      .setStrokeStyle(2, 0x00FF66, 1);
    this.#packetContainer.add(glow);

    // Inner data chip
    const chip = this.add.rectangle(0, 0, 12, 12, 0x052e18, 0.95)
      .setStrokeStyle(1, 0x3FF0FF, 0.8);
    this.#packetContainer.add(chip);

    const txt = this.add.text(0, 0, 'TX', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '9px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.#packetContainer.add(txt);

    // Pulse animation
    this.tweens.add({
      targets: this.#packetContainer,
      scale: { from: 1, to: 1.15 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  #handlePacketCollected(col, row) {
    this.#blocksCollected++;
    this.#miniScore += 20;
    runState.addScore(20);

    // Floating LINKED pop-up
    this.#showFloatingText(
      OFFSET_X + col * CELL_SIZE + 16,
      OFFSET_Y + row * CELL_SIZE + 16,
      'LINKED! +20',
      '#00FF66'
    );

    // Speed up every 5 blocks
    // 0-4: 160ms, 5-9: 135ms, 10-14: 110ms
    const speedTier = Math.floor(this.#blocksCollected / 5);
    this.#tickInterval = Math.max(90, 160 - speedTier * 25);

    // Spawn red malware tile from 8 blocks
    if (this.#blocksCollected >= 8 && !this.#malware) {
      this.#spawnMalware();
    }

    this.#updateHUD();

    // Check Win Condition: 15 blocks
    if (this.#blocksCollected >= WIN_BLOCKS) {
      this.#triggerVictory();
      return;
    }

    // Spawn next packet
    this.#spawnPacket();
  }

  #spawnGoldCoin() {
    if (this.#goldCoin) return;

    const freeCell = this.#getRandomFreeCell();
    const expiresAt = this.time.now + 5000;
    this.#goldCoin = { ...freeCell, expiresAt };

    const cx = OFFSET_X + freeCell.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = OFFSET_Y + freeCell.row * CELL_SIZE + CELL_SIZE / 2;

    this.#goldCoinContainer.removeAll(true);
    this.#goldCoinContainer.setPosition(cx, cy);
    this.#goldCoinContainer.setVisible(true);

    // Glowing coin graphic
    const coinGlow = this.add.circle(0, 0, 13, 0xFFD700, 0.3)
      .setStrokeStyle(2, 0xFFD700, 1);
    this.#goldCoinContainer.add(coinGlow);

    const coinCore = this.add.circle(0, 0, 9, 0xffaa00, 0.95);
    this.#goldCoinContainer.add(coinCore);

    const coinText = this.add.text(0, 0, '₿', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.#goldCoinContainer.add(coinText);

    // Pulsing rotation / scale
    this.tweens.add({
      targets: this.#goldCoinContainer,
      scaleX: { from: 1, to: 0.2 },
      duration: 500,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
    });

    // Despawn after 5 seconds
    this.time.delayedCall(5000, () => {
      if (this.#goldCoin) {
        this.#goldCoin = null;
        this.#goldCoinContainer.setVisible(false);
      }
    });
  }

  #handleGoldCoinCollected(col, row) {
    this.#miniScore += 100;
    runState.addScore(100);
    this.#goldCoin = null;
    this.#goldCoinContainer.setVisible(false);

    // Floating text
    this.#showFloatingText(
      OFFSET_X + col * CELL_SIZE + 16,
      OFFSET_Y + row * CELL_SIZE + 16,
      '+100 BLOCK REWARD',
      '#FFD700'
    );

    this.#updateHUD();
  }

  #spawnMalware() {
    const freeCell = this.#getRandomFreeCell(true);
    this.#malware = freeCell;

    const mx = OFFSET_X + freeCell.col * CELL_SIZE + CELL_SIZE / 2;
    const my = OFFSET_Y + freeCell.row * CELL_SIZE + CELL_SIZE / 2;

    this.#malwareContainer.removeAll(true);
    this.#malwareContainer.setPosition(mx, my);
    this.#malwareContainer.setVisible(true);

    // Glowing red malware box
    const redGlow = this.add.rectangle(0, 0, 24, 24, 0xFF0055, 0.4)
      .setStrokeStyle(2, 0xFF0055, 1);
    this.#malwareContainer.add(redGlow);

    const redCore = this.add.rectangle(0, 0, 14, 14, 0x3d0012, 0.95);
    this.#malwareContainer.add(redCore);

    const virusText = this.add.text(0, 0, '✕', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.#malwareContainer.add(virusText);

    // Flashing alert banner
    this.#showFloatingText(mx, my - 20, 'ALERT: MALWARE DETECTED', '#FF0055');
  }

  #stepMalware() {
    if (!this.#malware) return;

    // Pick a random adjacent cell (orthogonal) that stays within grid bounds
    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];
    Phaser.Utils.Array.Shuffle(dirs);

    for (const d of dirs) {
      const nc = this.#malware.col + d.x;
      const nr = this.#malware.row + d.y;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        this.#malware.col = nc;
        this.#malware.row = nr;
        break;
      }
    }

    const mx = OFFSET_X + this.#malware.col * CELL_SIZE + CELL_SIZE / 2;
    const my = OFFSET_Y + this.#malware.row * CELL_SIZE + CELL_SIZE / 2;

    this.tweens.add({
      targets: this.#malwareContainer,
      x: mx,
      y: my,
      duration: 150,
      ease: 'Linear',
    });

    // Check if malware moved directly onto snake head
    const head = this.#body[0];
    if (head.col === this.#malware.col && head.row === this.#malware.row) {
      this.#triggerDefeat('MALWARE INFECTION: CORRUPTED DATA');
    }
  }

  #getRandomFreeCell(farFromHead = false) {
    const head = this.#body[0] || { col: 0, row: 0 };
    let attempts = 0;
    while (attempts < 200) {
      attempts++;
      const col = Phaser.Math.Between(0, GRID_COLS - 1);
      const row = Phaser.Math.Between(0, GRID_ROWS - 1);

      // Check if on snake body
      const onSnake = this.#body.some((seg) => seg.col === col && seg.row === row);
      if (onSnake) continue;

      // Check if on packet
      if (this.#packet && this.#packet.col === col && this.#packet.row === row) continue;

      // Check if on gold coin
      if (this.#goldCoin && this.#goldCoin.col === col && this.#goldCoin.row === row) continue;

      // If requested far from head, ensure Manhattan distance >= 6
      if (farFromHead) {
        const dist = Math.abs(col - head.col) + Math.abs(row - head.row);
        if (dist < 6) continue;
      }

      return { col, row };
    }
    return { col: 1, row: 1 };
  }

  // Test / Debug accessors
  getHead() {
    return this.#body[0];
  }

  getPacket() {
    return this.#packet;
  }

  getBlocksCollected() {
    return this.#blocksCollected;
  }

  collectPacketDebug() {
    if (this.#packet) {
      this.#handlePacketCollected(this.#packet.col, this.#packet.row);
      const tail = this.#body[this.#body.length - 1];
      this.#body.push({ col: tail.col, row: tail.row });
      this.#renderSnake();
    }
  }

  triggerMalwareDebug() {
    this.#spawnMalware();
  }

  triggerGoldCoinDebug() {
    this.#spawnGoldCoin();
  }

  // ==========================================
  // SNAKE RENDERING (HEAD + GLOWING BLOCKS & LINKS)
  // ==========================================
  #renderSnake() {
    this.#snakeGraphics.clear();

    if (this.#body.length === 0) return;

    // 1. Update Head Sprite
    const head = this.#body[0];
    const headX = OFFSET_X + head.col * CELL_SIZE + CELL_SIZE / 2;
    const headY = OFFSET_Y + head.row * CELL_SIZE + CELL_SIZE / 2;

    this.#catHeadSprite.setPosition(headX, headY);
    if (this.#direction.x < 0) {
      this.#catHeadSprite.setFlipX(true);
    } else if (this.#direction.x > 0) {
      this.#catHeadSprite.setFlipX(false);
    }

    // 2. Draw Violet Links between adjacent segments
    for (let i = 1; i < this.#body.length; i++) {
      const prev = this.#body[i - 1];
      const curr = this.#body[i];

      const x1 = OFFSET_X + prev.col * CELL_SIZE + CELL_SIZE / 2;
      const y1 = OFFSET_Y + prev.row * CELL_SIZE + CELL_SIZE / 2;
      const x2 = OFFSET_X + curr.col * CELL_SIZE + CELL_SIZE / 2;
      const y2 = OFFSET_Y + curr.row * CELL_SIZE + CELL_SIZE / 2;

      // Small violet link line / connector
      this.#snakeGraphics.lineStyle(6, 0xA855F7, 0.95);
      this.#snakeGraphics.lineBetween(x1, y1, x2, y2);

      // Inner highlight line for neon energy tube feel
      this.#snakeGraphics.lineStyle(2, 0xFFE5FF, 0.9);
      this.#snakeGraphics.lineBetween(x1, y1, x2, y2);
    }

    // 3. Draw Glowing Cyan Blocks for Tail segments
    for (let i = 1; i < this.#body.length; i++) {
      const seg = this.#body[i];
      const sx = OFFSET_X + seg.col * CELL_SIZE + 4;
      const sy = OFFSET_Y + seg.row * CELL_SIZE + 4;
      const blockSize = CELL_SIZE - 8; // 24x24

      // Glowing cyan outer block
      this.#snakeGraphics.fillStyle(0x00E5FF, 0.92);
      this.#snakeGraphics.fillRoundedRect(sx, sy, blockSize, blockSize, 4);

      // Bright cyan stroke
      this.#snakeGraphics.lineStyle(2, 0x3FF0FF, 1);
      this.#snakeGraphics.strokeRoundedRect(sx, sy, blockSize, blockSize, 4);

      // Dark core microchip detail
      this.#snakeGraphics.fillStyle(0x052636, 0.85);
      this.#snakeGraphics.fillRoundedRect(sx + 5, sy + 5, blockSize - 10, blockSize - 10, 2);

      // Subtle cyan micro-node center
      this.#snakeGraphics.fillStyle(0x00E5FF, 0.95);
      this.#snakeGraphics.fillCircle(sx + blockSize / 2, sy + blockSize / 2, 2.5);
    }
  }

  // ==========================================
  // FLOATING TEXT EFFECT
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
      duration: 900,
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

    // Victory Flash
    this.cameras.main.flash(350, 0, 255, 100);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Win Modal Banner
    const banner = this.add.rectangle(cx, cy, 620, 160, 0x072818, 0.96)
      .setStrokeStyle(3, 0x00FF66, 1)
      .setDepth(150);

    const title = this.add.text(cx, cy - 40, '// PROTOCOL CONSENSUS REACHED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const header = this.add.text(cx, cy - 5, 'CHAIN SECURED!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '36px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const sub = this.add.text(cx, cy + 38, '15/15 BLOCKS MINED • RETURNING TO BATTLE PROTOCOL...', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#A8FFD0',
    }).setOrigin(0.5).setDepth(151);

    // Transition back via Win flow after 1.5s
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

  #triggerDefeat(reason = 'FATAL EXCEPTION') {
    if (this.#isGameOver || this.#hasWon) return;
    this.#isGameOver = true;
    this.#isPlaying = false;

    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, SESSION_END_REASONS.DEFEAT);
    }

    // Screen Shake on death
    this.cameras.main.shake(400, 0.025);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Chain Broken Banner
    const banner = this.add.rectangle(cx, cy, 620, 160, 0x2e0617, 0.96)
      .setStrokeStyle(3, 0xFF0055, 1)
      .setDepth(150);

    const title = this.add.text(cx, cy - 40, '// EXCEPTION: CONSENSUS COLLAPSED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FF6688',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const header = this.add.text(cx, cy - 5, 'CHAIN BROKEN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '38px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    const sub = this.add.text(cx, cy + 38, `${reason} • LOSING OPERATIVE LIFE...`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#FFC0D0',
    }).setOrigin(0.5).setDepth(151);

    // Transition back via Lose flow after 1.5s
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
}
