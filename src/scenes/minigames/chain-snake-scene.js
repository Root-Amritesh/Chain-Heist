import Phaser from '../../lib/phaser.js';
import { BaseScene } from '../base-scene.js';
import { SCENE_KEYS } from '../scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../../assets/font-keys.js';
import { AUDIO_ASSET_KEYS } from '../../assets/asset-keys.js';
import { dataManager } from '../../utils/data-manager.js';
import { runState } from '../../state/run-state.js';
import { TimeManager, SESSION_END_REASONS } from '../../systems/time-manager.js';
import { MiniGameClock } from '../../minigames/clock.js';
import { SNAKE_CONFIG } from '../../minigames/snake.config.js';
import {
  createMulberry32,
  cellKey,
  findFairSpawn,
  validateSpawn,
  isInBounds,
  getNeighbors,
} from '../../minigames/snake-engine.js';
import { playSoundFx } from '../../utils/audio-utils.js';

const {
  GRID: { COLS: GRID_COLS, ROWS: GRID_ROWS, CELL_SIZE, OFFSET_X, OFFSET_Y },
  TIMING: { TOTAL_TIME_SEC, START_TICK_MS, MIN_TICK_MS, RAMP_DURATION_SEC },
  WIN_BLOCKS,
  OBSTACLES: OBS_CFG,
  REWARDS: REW_CFG,
} = SNAKE_CONFIG;

export class ChainSnakeScene extends BaseScene {
  /** @type {object} */
  _data = {};

  /** @type {MiniGameClock | null} */
  #clock = null;

  /** @type {boolean} */
  #hasReportedResult = false;

  /** @type {() => number} */
  #rng = Math.random;

  // Snake State
  /** @type {Array<{col: number, row: number}>} */
  #body = [];

  /** @type {{x: number, y: number}} */
  #direction = { x: 1, y: 0 };

  /** @type {{x: number, y: number}} */
  #nextDirection = { x: 1, y: 0 };

  // Rewards State
  /** @type {{col: number, row: number} | null} */
  #packet = null;

  /** @type {Array<{col: number, row: number, type: string, expiresAt: number, value: number, container: Phaser.GameObjects.Container}>} */
  #rewards = [];

  // Obstacles State
  /** @type {Array<{col: number, row: number, clusterId: number}>} */
  #firewalls = [];

  /** @type {Array<{col: number, row: number, dirX: number, dirY: number, container: Phaser.GameObjects.Container}>} */
  #drones = [];

  /** @type {Array<{col: number, row: number, state: 'telegraph'|'active', expiresAt: number, container: Phaser.GameObjects.Container}>} */
  #corruptedCells = [];

  // Powerups & Multipliers
  /** @type {boolean} */
  #shieldActive = false;

  /** @type {number} */
  #magnetExpiresAt = 0;

  /** @type {number} */
  #slowMoExpiresAt = 0;

  /** @type {number} */
  #scoreX2ExpiresAt = 0;

  /** @type {number} */
  #virusExpiresAt = 0;

  /** @type {number} */
  #comboCount = 0;

  /** @type {number} */
  #comboLastTime = 0;

  // Timers and Progress
  /** @type {number} */
  #blocksCollected = 0;

  /** @type {number} */
  #miniScore = 0;

  /** @type {number} */
  #tickInterval = START_TICK_MS;

  /** @type {number} */
  #lastTickTime = 0;

  /** @type {number} */
  #droneLastMoveTime = 0;

  /** @type {number} */
  #lastFirewallAddTime = 0;

  /** @type {number} */
  #lastCorruptedSpawnTime = 0;

  /** @type {boolean} */
  #isPlaying = false;

  /** @type {boolean} */
  #isGameOver = false;

  /** @type {boolean} */
  #hasWon = false;

  // Visuals
  /** @type {Phaser.GameObjects.Graphics} */
  #gridGraphics;

  /** @type {Phaser.GameObjects.Graphics} */
  #snakeGraphics;

  /** @type {Phaser.GameObjects.Graphics} */
  #firewallGraphics;

  /** @type {Phaser.GameObjects.Graphics} */
  #powerupRingsGraphics;

  /** @type {Phaser.GameObjects.Image} */
  #catHeadSprite;

  /** @type {Phaser.GameObjects.Container} */
  #packetContainer;

  // HUD
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

  /** @type {Phaser.GameObjects.Text} */
  #comboText;

  /** @type {string | null} */
  #sessionId = null;

  constructor() {
    super({ key: SCENE_KEYS.CHAIN_SNAKE_SCENE });
  }

  init(data) {
    super.init(data);
    this._data = data || {};
    this.#hasReportedResult = false;
    this.#body = [];
    this.#direction = { x: 1, y: 0 };
    this.#nextDirection = { x: 1, y: 0 };
    this.#packet = null;
    this.#rewards = [];
    this.#firewalls = [];
    this.#drones = [];
    this.#corruptedCells = [];
    this.#shieldActive = false;
    this.#magnetExpiresAt = 0;
    this.#slowMoExpiresAt = 0;
    this.#scoreX2ExpiresAt = 0;
    this.#virusExpiresAt = 0;
    this.#comboCount = 0;
    this.#comboLastTime = 0;
    this.#blocksCollected = 0;
    this.#miniScore = 0;
    this.#tickInterval = START_TICK_MS;
    this.#lastTickTime = 0;
    this.#droneLastMoveTime = 0;
    this.#lastFirewallAddTime = 0;
    this.#lastCorruptedSpawnTime = 0;
    this.#isPlaying = false;
    this.#isGameOver = false;
    this.#hasWon = false;
    this.#sessionId = null;

    // Seeded PRNG
    const seed = runState.runStart || this._data?.runId || 'snake-chain-mempool';
    this.#rng = createMulberry32(seed);
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

    // Initialize Shared Monotonic MiniGameClock
    this.#clock = new MiniGameClock();
    this.#clock.on('expired', () => {
      this.#triggerDefeat('TIMEOUT: CONSENSUS EXPIRED');
    });

    // 1. Draw dark neon grid floor
    this.#drawNeonGridFloor();

    // 2. Initialize graphics layers
    this.#firewallGraphics = this.add.graphics().setDepth(5);
    this.#snakeGraphics = this.add.graphics().setDepth(10);
    this.#powerupRingsGraphics = this.add.graphics().setDepth(52);

    // 3. Head sprite
    const catChoice = runState.hunter || dataManager.getPlayerCat() || 'cat-1';
    const catKey = this.textures.exists(catChoice) ? catChoice : 'PLAYER';
    this.#catHeadSprite = this.add.image(0, 0, catKey)
      .setDepth(20)
      .setOrigin(0.5, 0.5);
    this.#catHeadSprite.setDisplaySize(28, 32);

    this.tweens.add({
      targets: this.#catHeadSprite,
      scaleY: { from: this.#catHeadSprite.scaleY, to: this.#catHeadSprite.scaleY * 1.08 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 4. Containers
    this.#packetContainer = this.add.container(0, 0).setDepth(15);

    // 5. Initial Snake Body
    this.#body = [
      { col: 8, row: 7 },
      { col: 7, row: 7 },
      { col: 6, row: 7 },
    ];

    // 6. Setup Initial Obstacles
    this.#initFirewallClusters();
    this.#initDrones();

    // 7. Spawn initial Transaction Packet
    this.#spawnPacket();

    // 8. Setup HUD Bar
    this.#createHUD();

    // 9. Setup Controls
    this.#setupControls();

    // 10. Initial Render
    this.#renderSnake();
    this.#renderFirewalls();

    // Clean shutdown handler
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#cleanup();
    });

    // 11. Start 3-2-1 Countdown
    this.#startCountdown();
  }

  update(time, delta) {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    // Update monotonic MiniGameClock and sync dual timers
    this.#clock.update();

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
    this.#updatePowerupHUD();

    // Dynamic difficulty ramp: START_TICK_MS -> MIN_TICK_MS over 90s
    const elapsedSec = TOTAL_TIME_SEC - this.#clock.remaining / 1000;
    const progress = Math.min(1, Math.max(0, elapsedSec / RAMP_DURATION_SEC));
    let baseInterval = START_TICK_MS - progress * (START_TICK_MS - MIN_TICK_MS);

    // Slow-mo modifier (60% speed -> 1.66x interval)
    if (time < this.#slowMoExpiresAt) {
      baseInterval = baseInterval / REW_CFG.SLOW_MO_SPEED_FACTOR;
    }
    this.#tickInterval = baseInterval;

    // Periodic Firewall spawning (+1 cluster every 20s up to cap)
    if (time >= this.#lastFirewallAddTime + OBS_CFG.FIREWALL_ADD_INTERVAL_SEC * 1000) {
      this.#lastFirewallAddTime = time;
      this.#addFirewallCluster();
    }

    // Periodic Corrupted Cell spawning
    if (time >= this.#lastCorruptedSpawnTime + OBS_CFG.CORRUPTED_CELL_INTERVAL_SEC * 1000) {
      this.#lastCorruptedSpawnTime = time;
      this.#spawnCorruptedCell(time);
    }

    // Update Corrupted Cells state
    this.#updateCorruptedCells(time);

    // Update Drones patrol movement (every 400ms)
    if (time >= this.#droneLastMoveTime + OBS_CFG.DRONE_STEP_MS) {
      this.#droneLastMoveTime = time;
      this.#stepDrones();
    }

    // Magnet powerup: pull rewards within 4 cells toward head
    if (time < this.#magnetExpiresAt) {
      this.#applyMagnetPull();
    }

    // Despawn expired temporary rewards
    this.#cleanupExpiredRewards(time);

    // Reset combo if window expired
    if (this.#comboCount > 0 && time > this.#comboLastTime + REW_CFG.COMBO_WINDOW_MS) {
      this.#comboCount = 0;
      this.#updateComboDisplay();
    }

    // Snake step tick
    if (time >= this.#lastTickTime + this.#tickInterval) {
      this.#lastTickTime = time;
      this.#stepSnake(time);
    }
  }

  // ==========================================
  // INITIALIZATION: OBSTACLES & DRONES
  // ==========================================
  #initFirewallClusters() {
    const numClusters = OBS_CFG.INITIAL_FIREWALL_MIN +
      Math.floor(this.#rng() * (OBS_CFG.INITIAL_FIREWALL_MAX - OBS_CFG.INITIAL_FIREWALL_MIN + 1));

    for (let c = 0; c < numClusters; c++) {
      this.#addFirewallCluster();
    }
  }

  #addFirewallCluster() {
    const currentClusters = new Set(this.#firewalls.map(f => f.clusterId)).size;
    if (currentClusters >= OBS_CFG.FIREWALL_MAX_CLUSTERS) return;

    const clusterId = Date.now() + Math.floor(this.#rng() * 100000);
    const clusterSize = OBS_CFG.FIREWALL_CLUSTER_SIZE_MIN +
      Math.floor(this.#rng() * (OBS_CFG.FIREWALL_CLUSTER_SIZE_MAX - OBS_CFG.FIREWALL_CLUSTER_SIZE_MIN + 1));

    const allObstacles = this.#getAllObstacleCells();
    const allRewards = this.#getAllRewardCells();

    // Find base seed cell for cluster
    const seed = findFairSpawn(
      this.#body,
      this.#direction,
      allObstacles,
      allRewards,
      this.#rng,
      true,
      SNAKE_CONFIG.FAIRNESS.MAX_SPAWN_ATTEMPTS
    );

    if (!seed) return;

    this.#firewalls.push({ col: seed.col, row: seed.row, clusterId });

    // Expand cluster to adjacent neighbors if fair
    let currentCell = seed;
    for (let i = 1; i < clusterSize; i++) {
      const neighbors = getNeighbors(currentCell.col, currentCell.row);
      Phaser.Utils.Array.Shuffle(neighbors);
      let added = false;
      for (const nb of neighbors) {
        const obsWithNew = this.#getAllObstacleCells();
        if (validateSpawn(nb, this.#body, this.#direction, obsWithNew, allRewards, true)) {
          this.#firewalls.push({ col: nb.col, row: nb.row, clusterId });
          currentCell = nb;
          added = true;
          break;
        }
      }
      if (!added) break;
    }

    this.#renderFirewalls();
  }

  #initDrones() {
    for (let i = 0; i < OBS_CFG.DRONE_COUNT; i++) {
      const allObstacles = this.#getAllObstacleCells();
      const allRewards = this.#getAllRewardCells();

      const spawn = findFairSpawn(
        this.#body,
        this.#direction,
        allObstacles,
        allRewards,
        this.#rng,
        true
      );

      if (spawn) {
        // Assign axis-aligned patrol direction (horizontal or vertical)
        const isHorizontal = this.#rng() > 0.5;
        const dirX = isHorizontal ? (this.#rng() > 0.5 ? 1 : -1) : 0;
        const dirY = !isHorizontal ? (this.#rng() > 0.5 ? 1 : -1) : 0;

        const container = this.add.container(
          OFFSET_X + spawn.col * CELL_SIZE + CELL_SIZE / 2,
          OFFSET_Y + spawn.row * CELL_SIZE + CELL_SIZE / 2
        ).setDepth(25);

        // Drone Visual
        const glow = this.add.circle(0, 0, 14, 0x00E5FF, 0.35)
          .setStrokeStyle(2, 0x00E5FF, 0.9);
        const core = this.add.rectangle(0, 0, 16, 16, 0x0a1c2e, 0.95)
          .setStrokeStyle(1.5, 0xA855F7, 1);
        const icon = this.add.text(0, 0, '◆', {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '13px',
          color: '#3FF0FF',
          fontStyle: 'bold',
        }).setOrigin(0.5);

        container.add([glow, core, icon]);

        this.tweens.add({
          targets: glow,
          scale: { from: 0.9, to: 1.2 },
          duration: 300,
          yoyo: true,
          repeat: -1,
        });

        this.#drones.push({
          col: spawn.col,
          row: spawn.row,
          dirX,
          dirY,
          container,
        });
      }
    }
  }

  #stepDrones() {
    for (const drone of this.#drones) {
      let nextCol = drone.col + drone.dirX;
      let nextRow = drone.row + drone.dirY;

      // Bounce at wall boundaries
      if (nextCol < 0 || nextCol >= GRID_COLS) {
        drone.dirX *= -1;
        nextCol = drone.col + drone.dirX;
      }
      if (nextRow < 0 || nextRow >= GRID_ROWS) {
        drone.dirY *= -1;
        nextRow = drone.row + drone.dirY;
      }

      // Check firewall collision -> bounce
      const hitFirewall = this.#firewalls.some(f => f.col === nextCol && f.row === nextRow);
      if (hitFirewall) {
        drone.dirX *= -1;
        drone.dirY *= -1;
        nextCol = drone.col + drone.dirX;
        nextRow = drone.row + drone.dirY;
      }

      drone.col = nextCol;
      drone.row = nextRow;

      this.tweens.add({
        targets: drone.container,
        x: OFFSET_X + drone.col * CELL_SIZE + CELL_SIZE / 2,
        y: OFFSET_Y + drone.row * CELL_SIZE + CELL_SIZE / 2,
        duration: 200,
        ease: 'Linear',
      });

      // Drone collision with Snake Head
      const head = this.#body[0];
      if (head && head.col === drone.col && head.row === drone.row) {
        if (this.#shieldActive) {
          this.#consumeShield('DRONE COLLISION BLOCKED BY SHIELD');
        } else {
          this.#triggerDefeat('INTERCEPTED BY PATROL DRONE');
          return;
        }
      }
    }
  }

  #spawnCorruptedCell(time) {
    const allObstacles = this.#getAllObstacleCells();
    const allRewards = this.#getAllRewardCells();

    const spawn = findFairSpawn(
      this.#body,
      this.#direction,
      allObstacles,
      allRewards,
      this.#rng,
      true
    );

    if (!spawn) return;

    const cx = OFFSET_X + spawn.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = OFFSET_Y + spawn.row * CELL_SIZE + CELL_SIZE / 2;

    const container = this.add.container(cx, cy).setDepth(8);

    // Telegraph flicker visual (yellow / warning orange)
    const telegraphBg = this.add.rectangle(0, 0, CELL_SIZE - 4, CELL_SIZE - 4, 0xffaa00, 0.4)
      .setStrokeStyle(2, 0xffd700, 0.9);
    const warnTxt = this.add.text(0, 0, '!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([telegraphBg, warnTxt]);

    // Flicker tween for 1s
    this.tweens.add({
      targets: telegraphBg,
      alpha: { from: 0.2, to: 0.8 },
      duration: 150,
      yoyo: true,
      repeat: 6,
    });

    this.#corruptedCells.push({
      col: spawn.col,
      row: spawn.row,
      state: 'telegraph',
      expiresAt: time + OBS_CFG.CORRUPTED_TELEGRAPH_MS + OBS_CFG.CORRUPTED_ACTIVE_MS,
      telegraphUntil: time + OBS_CFG.CORRUPTED_TELEGRAPH_MS,
      container,
    });
  }

  #updateCorruptedCells(time) {
    for (let i = this.#corruptedCells.length - 1; i >= 0; i--) {
      const cell = this.#corruptedCells[i];

      // Transition telegraph -> active deadly
      if (cell.state === 'telegraph' && time >= cell.telegraphUntil) {
        cell.state = 'active';
        cell.container.removeAll(true);

        const deadlyBg = this.add.rectangle(0, 0, CELL_SIZE - 4, CELL_SIZE - 4, 0x880033, 0.8)
          .setStrokeStyle(2, 0xff0055, 1);
        const icon = this.add.text(0, 0, '✖', {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: '14px',
          color: '#ff0055',
          fontStyle: 'bold',
        }).setOrigin(0.5);

        cell.container.add([deadlyBg, icon]);

        this.tweens.add({
          targets: deadlyBg,
          scale: { from: 0.95, to: 1.05 },
          duration: 300,
          yoyo: true,
          repeat: -1,
        });
      }

      // Despawn when expired
      if (time >= cell.expiresAt) {
        cell.container.destroy();
        this.#corruptedCells.splice(i, 1);
        continue;
      }

      // If active and snake head steps on it
      if (cell.state === 'active') {
        const head = this.#body[0];
        if (head && head.col === cell.col && head.row === cell.row) {
          if (this.#shieldActive) {
            this.#consumeShield('CORRUPTION PURGED BY SHIELD');
            cell.container.destroy();
            this.#corruptedCells.splice(i, 1);
          } else {
            this.#triggerDefeat('CORRUPTED CELL INFECTION');
            return;
          }
        }
      }
    }
  }

  // ==========================================
  // GRID FLOOR DRAWING & FIREWALLS
  // ==========================================
  #drawNeonGridFloor() {
    this.#gridGraphics = this.add.graphics().setDepth(1);
    this.#gridGraphics.fillStyle(0x0a0618, 0.85);
    this.#gridGraphics.fillRect(OFFSET_X, OFFSET_Y, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);

    this.#gridGraphics.lineStyle(1, 0x1b1338, 0.55);
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = OFFSET_X + c * CELL_SIZE;
      this.#gridGraphics.lineBetween(x, OFFSET_Y, x, OFFSET_Y + GRID_ROWS * CELL_SIZE);
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = OFFSET_Y + r * CELL_SIZE;
      this.#gridGraphics.lineBetween(OFFSET_X, y, OFFSET_X + GRID_COLS * CELL_SIZE, y);
    }

    this.#gridGraphics.lineStyle(2, 0x00E5FF, 0.85);
    this.#gridGraphics.strokeRect(OFFSET_X, OFFSET_Y, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);

    const bracketSize = 12;
    this.#gridGraphics.lineStyle(3, 0xA855F7, 1);
    this.#gridGraphics.lineBetween(OFFSET_X - 2, OFFSET_Y - 2, OFFSET_X + bracketSize, OFFSET_Y - 2);
    this.#gridGraphics.lineBetween(OFFSET_X - 2, OFFSET_Y - 2, OFFSET_X - 2, OFFSET_Y + bracketSize);
    const rX = OFFSET_X + GRID_COLS * CELL_SIZE + 2;
    this.#gridGraphics.lineBetween(rX, OFFSET_Y - 2, rX - bracketSize, OFFSET_Y - 2);
    this.#gridGraphics.lineBetween(rX, OFFSET_Y - 2, rX, OFFSET_Y + bracketSize);
    const bY = OFFSET_Y + GRID_ROWS * CELL_SIZE + 2;
    this.#gridGraphics.lineBetween(OFFSET_X - 2, bY, OFFSET_X + bracketSize, bY);
    this.#gridGraphics.lineBetween(OFFSET_X - 2, bY, OFFSET_X - 2, bY - bracketSize);
    this.#gridGraphics.lineBetween(rX, bY, rX - bracketSize, bY);
    this.#gridGraphics.lineBetween(rX, bY, rX, bY - bracketSize);
  }

  #renderFirewalls() {
    this.#firewallGraphics.clear();
    for (const fw of this.#firewalls) {
      const x = OFFSET_X + fw.col * CELL_SIZE + 2;
      const y = OFFSET_Y + fw.row * CELL_SIZE + 2;
      const size = CELL_SIZE - 4;

      // Red/Orange firewall neon block
      this.#firewallGraphics.fillStyle(0x3a0815, 0.95);
      this.#firewallGraphics.fillRoundedRect(x, y, size, size, 4);

      this.#firewallGraphics.lineStyle(2, 0xFF3366, 0.95);
      this.#firewallGraphics.strokeRoundedRect(x, y, size, size, 4);

      // Warning lattice lines
      this.#firewallGraphics.lineStyle(1, 0xFF8800, 0.6);
      this.#firewallGraphics.lineBetween(x + 4, y + 4, x + size - 4, y + size - 4);
      this.#firewallGraphics.lineBetween(x + size - 4, y + 4, x + 4, y + size - 4);
    }
  }

  // ==========================================
  // HUD CREATION & UPDATES
  // ==========================================
  #createHUD() {
    const hudY = 32;
    const width = this.scale.width;

    this.add.rectangle(width / 2, hudY, width - 40, 52, 0x090518, 0.95)
      .setStrokeStyle(2, 0x00E5FF, 0.85)
      .setDepth(50);

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

    this.#blocksText = this.add.text(width * 0.38, hudY - 10, `BLOCKS: 0/${WIN_BLOCKS}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    this.#blocksBarGraphics = this.add.graphics().setDepth(51);
    this.#updateBlocksBar();

    this.#comboText = this.add.text(width * 0.50, hudY, '', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

    this.#scoreText = this.add.text(width * 0.65, hudY, `SCORE: ${this.#miniScore} BIT`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(51);

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
    const barW = 100;
    const barH = 7;
    const barX = this.scale.width * 0.38 - barW / 2;
    const barY = 32 + 10;

    this.#blocksBarGraphics.fillStyle(0x130a2a, 1);
    this.#blocksBarGraphics.fillRect(barX, barY, barW, barH);
    this.#blocksBarGraphics.lineStyle(1, 0x00E5FF, 0.5);
    this.#blocksBarGraphics.strokeRect(barX, barY, barW, barH);

    const fillRatio = Math.min(1, this.#blocksCollected / WIN_BLOCKS);
    if (fillRatio > 0) {
      this.#blocksBarGraphics.fillStyle(0x00FF66, 1);
      this.#blocksBarGraphics.fillRect(barX + 1, barY + 1, (barW - 2) * fillRatio, barH - 2);
    }
  }

  #updateTimerDisplay() {
    if (!this.#timerText?.scene || !this.#worldTimerText?.scene || !this.#clock) return;

    const remainingSec = Math.ceil(this.#clock.remaining / 1000);
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.#timerText.setText(`TIME: ${formatted}`);

    if (remainingSec <= 10) {
      this.#timerText.setColor('#FF3366');
    } else {
      this.#timerText.setColor('#00E5FF');
    }

    const readout = TimeManager.getLiveReadout();
    this.#worldTimerText.setText(`WORLD: ${readout.formattedLiveWorldTime}`);
    if (readout.liveWorldRemainingSec <= 60) {
      this.#worldTimerText.setColor('#FF3366');
    } else {
      this.#worldTimerText.setColor('#8E8AAB');
    }
  }

  #updatePowerupHUD() {
    this.#powerupRingsGraphics.clear();
    const now = this.time.now;
    const hudY = 32;

    let iconX = this.scale.width * 0.77;
    const iconSpacing = 24;

    const drawRing = (ratio, color, label) => {
      this.#powerupRingsGraphics.lineStyle(2, 0x222233, 1);
      this.#powerupRingsGraphics.strokeCircle(iconX, hudY, 9);

      if (ratio > 0) {
        this.#powerupRingsGraphics.lineStyle(2.5, color, 1);
        this.#powerupRingsGraphics.beginPath();
        this.#powerupRingsGraphics.arc(iconX, hudY, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
        this.#powerupRingsGraphics.strokePath();
      }

      this.#powerupRingsGraphics.fillStyle(color, 1);
      this.#powerupRingsGraphics.fillCircle(iconX, hudY, 4);

      iconX += iconSpacing;
    };

    if (this.#shieldActive) {
      drawRing(1, 0x00E5FF, 'S');
    }

    if (now < this.#magnetExpiresAt) {
      const rem = (this.#magnetExpiresAt - now) / REW_CFG.MAGNET_DURATION_MS;
      drawRing(rem, 0xA855F7, 'M');
    }

    if (now < this.#slowMoExpiresAt) {
      const rem = (this.#slowMoExpiresAt - now) / REW_CFG.SLOW_MO_DURATION_MS;
      drawRing(rem, 0x3FF0FF, 'SL');
    }

    if (now < this.#scoreX2ExpiresAt) {
      const rem = (this.#scoreX2ExpiresAt - now) / REW_CFG.SCORE_X2_DURATION_MS;
      drawRing(rem, 0xFFD700, 'X2');
    }

    if (now < this.#virusExpiresAt) {
      const rem = (this.#virusExpiresAt - now) / REW_CFG.VIRUS_DURATION_MS;
      drawRing(rem, 0xFF0055, 'V');
    }
  }

  #updateComboDisplay() {
    if (this.#comboCount > 1) {
      this.#comboText.setText(`COMBO x${this.#comboCount}!`);
      this.#comboText.setScale(1.2);
      this.tweens.add({
        targets: this.#comboText,
        scale: 1.0,
        duration: 150,
      });
    } else {
      this.#comboText.setText('');
    }
  }

  // ==========================================
  // CONTROLS & STEERING
  // ==========================================
  #setupControls() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on('keydown-UP', () => this.#queueDirection(0, -1));
    keyboard.on('keydown-DOWN', () => this.#queueDirection(0, 1));
    keyboard.on('keydown-LEFT', () => this.#queueDirection(-1, 0));
    keyboard.on('keydown-RIGHT', () => this.#queueDirection(1, 0));

    keyboard.on('keydown-W', () => this.#queueDirection(0, -1));
    keyboard.on('keydown-S', () => this.#queueDirection(0, 1));
    keyboard.on('keydown-A', () => this.#queueDirection(-1, 0));
    keyboard.on('keydown-D', () => this.#queueDirection(1, 0));
  }

  #queueDirection(dx, dy) {
    if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;

    // Virus reverses controls
    if (this.time.now < this.#virusExpiresAt) {
      dx = -dx;
      dy = -dy;
    }

    if (dx !== 0 && this.#direction.x !== 0) return;
    if (dy !== 0 && this.#direction.y !== 0) return;

    this.#nextDirection = { x: dx, y: dy };
  }

  // ==========================================
  // 3-2-1 COUNTDOWN & START
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
    this.#droneLastMoveTime = this.time.now;
    this.#lastFirewallAddTime = this.time.now;
    this.#lastCorruptedSpawnTime = this.time.now;

    // Start Monotonic Clock
    this.#clock.start(TOTAL_TIME_SEC * 1000);

    // Periodically spawn random powerup/reward items
    this.time.addEvent({
      delay: 7000,
      loop: true,
      callback: () => {
        if (!this.#isPlaying || this.#isGameOver || this.#hasWon) return;
        this.#spawnRandomReward();
      },
    });
  }

  // ==========================================
  // SNAKE TICK & GAMEPLAY RESOLUTION
  // ==========================================
  #stepSnake(time) {
    this.#direction = { ...this.#nextDirection };

    const head = this.#body[0];
    const nextCol = head.col + this.#direction.x;
    const nextRow = head.row + this.#direction.y;

    // 1. Wall Collision
    if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) {
      if (this.#shieldActive) {
        this.#consumeShield('WALL IMPACT ABSORBED BY SHIELD');
        // Prevent moving out of bounds by reversing next direction
        this.#nextDirection = { x: -this.#direction.x, y: -this.#direction.y };
        return;
      }
      this.#triggerDefeat('PERIMETER BREACH: WALL COLLISION');
      return;
    }

    // 2. Firewall Collision
    const hitFwIndex = this.#firewalls.findIndex(f => f.col === nextCol && f.row === nextRow);
    if (hitFwIndex !== -1) {
      if (this.#shieldActive) {
        this.#consumeShield('FIREWALL DESTROYED BY SHIELD');
        this.#firewalls.splice(hitFwIndex, 1);
        this.#renderFirewalls();
      } else {
        this.#triggerDefeat('FIREWALL LOCKDOWN: SYSTEM BLOCKED');
        return;
      }
    }

    // 3. Drone Collision
    const hitDrone = this.#drones.find(d => d.col === nextCol && d.row === nextRow);
    if (hitDrone) {
      if (this.#shieldActive) {
        this.#consumeShield('PATROL DRONE ABSORBED BY SHIELD');
      } else {
        this.#triggerDefeat('INTERCEPTED BY PATROL DRONE');
        return;
      }
    }

    // 4. Corrupted Cell Collision
    const hitCorrupted = this.#corruptedCells.find(c => c.col === nextCol && c.row === nextRow && c.state === 'active');
    if (hitCorrupted) {
      if (this.#shieldActive) {
        this.#consumeShield('CORRUPTED CELL NEUTRALIZED');
      } else {
        this.#triggerDefeat('CORRUPTED CELL INFECTION');
        return;
      }
    }

    // 5. Self Tail Collision
    const isHittingTail = this.#body.some((segment, idx) => {
      if (idx === 0) return false;
      return segment.col === nextCol && segment.row === nextRow;
    });

    if (isHittingTail) {
      if (this.#shieldActive) {
        this.#consumeShield('CHAIN INTEGRITY SAVED BY SHIELD');
      } else {
        this.#triggerDefeat('INTEGRITY COLLAPSE: CHAIN COLLISION');
        return;
      }
    }

    // Move Head
    const newHead = { col: nextCol, row: nextRow };
    this.#body.unshift(newHead);

    // 6. Check Transaction Packet Collection
    let didEatPacket = false;
    if (this.#packet && this.#packet.col === nextCol && this.#packet.row === nextRow) {
      didEatPacket = true;
      this.#handlePacketCollected(nextCol, nextRow);
    }

    // If packet was NOT eaten, remove tail segment
    if (!didEatPacket) {
      this.#body.pop();
    }

    // 7. Check Other Rewards Collection
    for (let i = this.#rewards.length - 1; i >= 0; i--) {
      const rew = this.#rewards[i];
      if (rew.col === nextCol && rew.row === nextRow) {
        this.#handleRewardCollected(rew, i);
      }
    }

    // Render updated snake
    this.#renderSnake();
  }

  // ==========================================
  // ITEM & REWARD HANDLING
  // ==========================================
  #spawnPacket() {
    const allObstacles = this.#getAllObstacleCells();
    const allRewards = this.#getAllRewardCells();

    const freeCell = findFairSpawn(
      this.#body,
      this.#direction,
      allObstacles,
      allRewards,
      this.#rng,
      false,
      SNAKE_CONFIG.FAIRNESS.MAX_SPAWN_ATTEMPTS
    ) || { col: 1, row: 1 };

    this.#packet = freeCell;

    const px = OFFSET_X + freeCell.col * CELL_SIZE + CELL_SIZE / 2;
    const py = OFFSET_Y + freeCell.row * CELL_SIZE + CELL_SIZE / 2;

    this.#packetContainer.removeAll(true);
    this.#packetContainer.setPosition(px, py);

    const glow = this.add.rectangle(0, 0, 22, 22, 0x00FF66, 0.4)
      .setStrokeStyle(2, 0x00FF66, 1);
    this.#packetContainer.add(glow);

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

    // Calculate Combo Multiplier
    const now = this.time.now;
    if (now <= this.#comboLastTime + REW_CFG.COMBO_WINDOW_MS) {
      this.#comboCount = Math.min(REW_CFG.COMBO_MAX_MULTIPLIER, this.#comboCount + 1);
    } else {
      this.#comboCount = 1;
    }
    this.#comboLastTime = now;
    this.#updateComboDisplay();

    let points = 20 * this.#comboCount;
    if (now < this.#scoreX2ExpiresAt) {
      points *= 2;
    }

    this.#miniScore += points;
    runState.addScore(points);

    // Particle Burst
    this.#emitParticles(OFFSET_X + col * CELL_SIZE + 16, OFFSET_Y + row * CELL_SIZE + 16, 0x00FF66);

    // Play pickup sound
    try {
      playSoundFx(this, AUDIO_ASSET_KEYS.ICE);
    } catch (_) {}

    this.#showFloatingText(
      OFFSET_X + col * CELL_SIZE + 16,
      OFFSET_Y + row * CELL_SIZE + 16,
      `+${points} LINKED!`,
      '#00FF66'
    );

    this.#updateHUD();

    if (this.#blocksCollected >= WIN_BLOCKS) {
      this.#triggerVictory();
      return;
    }

    this.#spawnPacket();
  }

  #spawnRandomReward() {
    if (this.#rewards.length >= 3) return;

    const allObstacles = this.#getAllObstacleCells();
    const allRewards = this.#getAllRewardCells();

    const spawn = findFairSpawn(
      this.#body,
      this.#direction,
      allObstacles,
      allRewards,
      this.#rng,
      false
    );

    if (!spawn) return;

    // Pick type
    const roll = this.#rng();
    let type = 'coin';
    let duration = 8000;
    let color = 0xFFD700;
    let label = '₿';

    if (roll < 0.35) {
      type = 'coin';
      label = '+10';
      color = 0xFFD700;
    } else if (roll < 0.50) {
      type = 'crystal';
      label = '♦';
      color = 0x00E5FF;
    } else if (roll < 0.65) {
      type = 'timeShard';
      label = '+5s';
      color = 0x3FF0FF;
    } else if (roll < 0.75) {
      type = 'shield';
      label = '🛡';
      color = 0x00FF66;
    } else if (roll < 0.85) {
      type = 'magnet';
      label = '🧲';
      color = 0xA855F7;
    } else if (roll < 0.92) {
      type = 'slowMo';
      label = '⏳';
      color = 0x3FF0FF;
    } else if (roll < 0.96) {
      type = 'scoreX2';
      label = '2X';
      color = 0xFFAA00;
    } else {
      type = 'virus';
      label = '☣';
      color = 0xFF0055;
    }

    const cx = OFFSET_X + spawn.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = OFFSET_Y + spawn.row * CELL_SIZE + CELL_SIZE / 2;

    const container = this.add.container(cx, cy).setDepth(16);
    const glow = this.add.circle(0, 0, 13, color, 0.35).setStrokeStyle(1.5, color, 1);
    const core = this.add.circle(0, 0, 9, 0x111122, 0.9);
    const txt = this.add.text(0, 0, label, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: label.length > 2 ? '9px' : '12px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([glow, core, txt]);

    this.tweens.add({
      targets: container,
      scale: { from: 0.9, to: 1.15 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.#rewards.push({
      col: spawn.col,
      row: spawn.row,
      type,
      expiresAt: this.time.now + duration,
      container,
    });
  }

  #handleRewardCollected(reward, index) {
    const { type, col, row, container } = reward;
    container.destroy();
    this.#rewards.splice(index, 1);

    const now = this.time.now;
    const px = OFFSET_X + col * CELL_SIZE + 16;
    const py = OFFSET_Y + row * CELL_SIZE + 16;

    // SFX
    try {
      playSoundFx(this, AUDIO_ASSET_KEYS.ICE);
    } catch (_) {}

    switch (type) {
      case 'coin': {
        let pts = REW_CFG.COIN_POINTS;
        if (now < this.#scoreX2ExpiresAt) pts *= 2;
        this.#miniScore += pts;
        runState.addScore(pts);
        this.#emitParticles(px, py, 0xFFD700);
        this.#showFloatingText(px, py, `+${pts} BIT`, '#FFD700');
        break;
      }
      case 'crystal': {
        let pts = REW_CFG.DATA_CRYSTAL_POINTS;
        if (now < this.#scoreX2ExpiresAt) pts *= 2;
        this.#miniScore += pts;
        runState.addScore(pts);
        this.#emitParticles(px, py, 0x00E5FF);
        this.#showFloatingText(px, py, `+${pts} DATA CRYSTAL!`, '#00E5FF');
        break;
      }
      case 'timeShard': {
        if (this.#clock) {
          this.#clock.addTime(REW_CFG.TIME_SHARD_BONUS_SEC * 1000);
        }
        this.#emitParticles(px, py, 0x3FF0FF);
        this.#showFloatingText(px, py, '+5s RECOVERY', '#3FF0FF');
        break;
      }
      case 'shield': {
        this.#shieldActive = true;
        this.#emitParticles(px, py, 0x00FF66);
        this.#showFloatingText(px, py, 'SHIELD ARMED', '#00FF66');
        break;
      }
      case 'magnet': {
        this.#magnetExpiresAt = now + REW_CFG.MAGNET_DURATION_MS;
        this.#emitParticles(px, py, 0xA855F7);
        this.#showFloatingText(px, py, 'MAGNET 8s', '#A855F7');
        break;
      }
      case 'slowMo': {
        this.#slowMoExpiresAt = now + REW_CFG.SLOW_MO_DURATION_MS;
        this.#emitParticles(px, py, 0x3FF0FF);
        this.#showFloatingText(px, py, 'SLOW-MO 6s', '#3FF0FF');
        break;
      }
      case 'scoreX2': {
        this.#scoreX2ExpiresAt = now + REW_CFG.SCORE_X2_DURATION_MS;
        this.#emitParticles(px, py, 0xFFAA00);
        this.#showFloatingText(px, py, 'SCORE 2X 10s', '#FFAA00');
        break;
      }
      case 'virus': {
        this.#virusExpiresAt = now + REW_CFG.VIRUS_DURATION_MS;
        const penalty = Math.abs(REW_CFG.VIRUS_PENALTY_POINTS);
        this.#miniScore = Math.max(0, this.#miniScore - penalty);
        runState.addScore(-penalty);
        this.#emitParticles(px, py, 0xFF0055);
        this.cameras.main.shake(200, 0.015);
        this.#showFloatingText(px, py, 'VIRUS: REVERSE CONTROLS -20', '#FF0055');
        break;
      }
    }

    this.#updateHUD();
  }

  #consumeShield(reason) {
    this.#shieldActive = false;
    this.cameras.main.shake(250, 0.02);
    try {
      playSoundFx(this, AUDIO_ASSET_KEYS.CLAW);
    } catch (_) {}
    const head = this.#body[0];
    if (head) {
      this.#showFloatingText(
        OFFSET_X + head.col * CELL_SIZE + 16,
        OFFSET_Y + head.row * CELL_SIZE + 16,
        reason,
        '#00E5FF'
      );
    }
  }

  #applyMagnetPull() {
    const head = this.#body[0];
    if (!head) return;

    for (const rew of this.#rewards) {
      const dCol = head.col - rew.col;
      const dRow = head.row - rew.row;
      const dist = Math.abs(dCol) + Math.abs(dRow);

      if (dist > 0 && dist <= REW_CFG.MAGNET_RADIUS_CELLS) {
        const stepCol = rew.col + Math.sign(dCol);
        const stepRow = rew.row + Math.sign(dRow);

        rew.col = stepCol;
        rew.row = stepRow;

        this.tweens.add({
          targets: rew.container,
          x: OFFSET_X + rew.col * CELL_SIZE + CELL_SIZE / 2,
          y: OFFSET_Y + rew.row * CELL_SIZE + CELL_SIZE / 2,
          duration: 100,
        });
      }
    }
  }

  #cleanupExpiredRewards(time) {
    for (let i = this.#rewards.length - 1; i >= 0; i--) {
      const rew = this.#rewards[i];
      if (time >= rew.expiresAt) {
        rew.container.destroy();
        this.#rewards.splice(i, 1);
      }
    }
  }

  #getAllObstacleCells() {
    const cells = [];
    for (const fw of this.#firewalls) cells.push({ col: fw.col, row: fw.row });
    for (const dr of this.#drones) cells.push({ col: dr.col, row: dr.row });
    for (const cc of this.#corruptedCells) cells.push({ col: cc.col, row: cc.row });
    return cells;
  }

  #getAllRewardCells() {
    const cells = [];
    if (this.#packet) cells.push({ col: this.#packet.col, row: this.#packet.row });
    for (const r of this.#rewards) cells.push({ col: r.col, row: r.row });
    return cells;
  }

  // ==========================================
  // PARTICLES & FEEL
  // ==========================================
  #emitParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(x, y, 3, color, 1).setDepth(40);
      const angle = (Math.PI * 2 * i) / 8;
      const dist = 24 + this.#rng() * 16;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ==========================================
  // SNAKE RENDERING
  // ==========================================
  #renderSnake() {
    this.#snakeGraphics.clear();
    if (this.#body.length === 0) return;

    const head = this.#body[0];
    const headX = OFFSET_X + head.col * CELL_SIZE + CELL_SIZE / 2;
    const headY = OFFSET_Y + head.row * CELL_SIZE + CELL_SIZE / 2;

    this.#catHeadSprite.setPosition(headX, headY);
    if (this.#direction.x < 0) {
      this.#catHeadSprite.setFlipX(true);
    } else if (this.#direction.x > 0) {
      this.#catHeadSprite.setFlipX(false);
    }

    // Connectors
    for (let i = 1; i < this.#body.length; i++) {
      const prev = this.#body[i - 1];
      const curr = this.#body[i];

      const x1 = OFFSET_X + prev.col * CELL_SIZE + CELL_SIZE / 2;
      const y1 = OFFSET_Y + prev.row * CELL_SIZE + CELL_SIZE / 2;
      const x2 = OFFSET_X + curr.col * CELL_SIZE + CELL_SIZE / 2;
      const y2 = OFFSET_Y + curr.row * CELL_SIZE + CELL_SIZE / 2;

      this.#snakeGraphics.lineStyle(6, 0xA855F7, 0.95);
      this.#snakeGraphics.lineBetween(x1, y1, x2, y2);
      this.#snakeGraphics.lineStyle(2, 0xFFE5FF, 0.9);
      this.#snakeGraphics.lineBetween(x1, y1, x2, y2);
    }

    // Blocks
    for (let i = 1; i < this.#body.length; i++) {
      const seg = this.#body[i];
      const sx = OFFSET_X + seg.col * CELL_SIZE + 4;
      const sy = OFFSET_Y + seg.row * CELL_SIZE + 4;
      const blockSize = CELL_SIZE - 8;

      this.#snakeGraphics.fillStyle(0x00E5FF, 0.92);
      this.#snakeGraphics.fillRoundedRect(sx, sy, blockSize, blockSize, 4);

      this.#snakeGraphics.lineStyle(2, 0x3FF0FF, 1);
      this.#snakeGraphics.strokeRoundedRect(sx, sy, blockSize, blockSize, 4);

      this.#snakeGraphics.fillStyle(0x052636, 0.85);
      this.#snakeGraphics.fillRoundedRect(sx + 5, sy + 5, blockSize - 10, blockSize - 10, 2);

      this.#snakeGraphics.fillStyle(0x00E5FF, 0.95);
      this.#snakeGraphics.fillCircle(sx + blockSize / 2, sy + blockSize / 2, 2.5);
    }

    // Shield Aura around head
    if (this.#shieldActive) {
      this.#snakeGraphics.lineStyle(3, 0x00E5FF, 0.85);
      this.#snakeGraphics.strokeCircle(headX, headY, 20);
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
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ==========================================
  // WIN & DEFEAT OUTCOMES (SINGLE RESULT GUARANTEE)
  // ==========================================
  #triggerVictory() {
    if (this.#hasReportedResult || this.#hasWon || this.#isGameOver) return;
    this.#hasReportedResult = true;
    this.#hasWon = true;
    this.#isPlaying = false;

    if (this.#clock) this.#clock.stop();

    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, SESSION_END_REASONS.WIN);
    }

    this.cameras.main.flash(350, 0, 255, 100);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 620, 160, 0x072818, 0.96)
      .setStrokeStyle(3, 0x00FF66, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// PROTOCOL CONSENSUS REACHED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'CHAIN SECURED!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '36px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, '15/15 BLOCKS MINED • RETURNING TO BATTLE PROTOCOL...', {
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

  #triggerDefeat(reason = 'FATAL EXCEPTION') {
    if (this.#hasReportedResult || this.#isGameOver || this.#hasWon) return;
    this.#hasReportedResult = true;
    this.#isGameOver = true;
    this.#isPlaying = false;

    if (this.#clock) this.#clock.stop();

    if (this.#sessionId) {
      TimeManager.endSession(this.#sessionId, SESSION_END_REASONS.DEFEAT);
    }

    this.cameras.main.shake(400, 0.025);
    try {
      playSoundFx(this, AUDIO_ASSET_KEYS.CLAW);
    } catch (_) {}

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(cx, cy, 620, 160, 0x2e0617, 0.96)
      .setStrokeStyle(3, 0xFF0055, 1)
      .setDepth(150);

    this.add.text(cx, cy - 40, '// EXCEPTION: CONSENSUS COLLAPSED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FF6688',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy - 5, 'CHAIN BROKEN', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '38px',
      color: '#FF0055',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(151);

    this.add.text(cx, cy + 38, `${reason} • RETURNING TO BATTLE PROTOCOL...`, {
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

  #cleanup() {
    if (this.#clock) {
      this.#clock.destroy();
      this.#clock = null;
    }
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.removeAllListeners();
    }
    for (const d of this.#drones) {
      if (d.container) d.container.destroy();
    }
    for (const c of this.#corruptedCells) {
      if (c.container) c.container.destroy();
    }
    for (const r of this.#rewards) {
      if (r.container) r.container.destroy();
    }
    this.tweens.killAll();
  }
}
