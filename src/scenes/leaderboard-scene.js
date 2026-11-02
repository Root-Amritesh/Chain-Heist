import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { runState } from '../state/run-state.js';
import { dataManager } from '../utils/data-manager.js';
import { DATA_MANAGER_STORE_KEYS } from '../utils/data-manager.js';
import { leaderboard } from '../systems/leaderboard.js';
import { MAX_DISTRICTS } from '../config.js';

const HUNTER_COLORS = {
  'cat-1': '#00FFFF',
  'cat-2': '#FF00FF',
  'cat-3': '#B366FF',
  'cat-4': '#FFD700',
};

/** @type {import('../systems/leaderboard.js').LeaderboardEntry[]} */
const DEFAULT_SEEDS = [
  { name: 'SATOSHI', hunter: 'cat-4', score: 8500, badge: 'GOLD', verificationCode: '#0000-B1TC', districts: 4, tokens: 10, timestamp: Date.now() - 3600000 },
  { name: 'HAL_FINNEY', hunter: 'cat-1', score: 7100, badge: 'GOLD', verificationCode: '#4A21-F900', districts: 4, tokens: 9, timestamp: Date.now() - 7200000 },
  { name: 'NICK_SZABO', hunter: 'cat-3', score: 5800, badge: 'SILVER', verificationCode: '#7BC3-A1E2', districts: 4, tokens: 8, timestamp: Date.now() - 14400000 },
  { name: 'VITALIK', hunter: 'cat-2', score: 4950, badge: 'SILVER', verificationCode: '#E701-44B8', districts: 3, tokens: 7, timestamp: Date.now() - 28800000 },
  { name: 'CYPHERPUNK', hunter: 'cat-1', score: 3850, badge: 'BRONZE', verificationCode: '#C982-10F3', districts: 3, tokens: 5, timestamp: Date.now() - 43200000 },
];

export class LeaderboardScene extends BaseScene {
  /** @type {boolean} */
  #isConfirmed = false;
  /** @type {'all' | 'today'} */
  #currentTab = 'all';
  /** @type {Phaser.GameObjects.Container | undefined} */
  #tableContainer;
  /** @type {Phaser.GameObjects.Text | undefined} */
  #tabAllText;
  /** @type {Phaser.GameObjects.Text | undefined} */
  #tabTodayText;
  /** @type {Phaser.GameObjects.Text | undefined} */
  #liveIndicatorText;
  /** @type {Function | null} */
  #stopPolling = null;
  /** @type {string | null} */
  #lastRunCode = null;
  /** @type {number} */
  #lastFetchTimestamp = Date.now();
  /** @type {boolean} */
  #isLoading = false;

  constructor() {
    super({
      key: SCENE_KEYS.LEADERBOARD_SCENE,
    });
  }

  create() {
    super.create();
    this.#isConfirmed = false;
    this.#isLoading = false;
    this.#lastFetchTimestamp = Date.now();

    this.cameras.main.setBackgroundColor('#060412');
    this.cameras.main.fadeIn(500);

    const width = this.scale.width;
    const height = this.scale.height;

    // Background Grid
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1b1435, 0.4);
    for (let x = 0; x < width; x += 32) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 32) {
      grid.lineBetween(0, y, width, y);
    }

    // Top Header
    this.add.rectangle(width / 2, 46, 860, 52, 0x09051c, 0.96)
      .setStrokeStyle(2, 0x3FF0FF, 1);

    this.add.text(width / 2, 36, 'THE LEDGER', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '26px',
      color: '#3FF0FF',
      fontStyle: 'bold',
      stroke: '#04020a',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, 58, 'IMMUTABLE CONSENSUS ARCHIVE // TOP OPERATIVE RUNS', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // Live Indicator with "updated Ns ago"
    this.#liveIndicatorText = this.add.text(width / 2 + 270, 46, '● LIVE • updated 0s ago', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '10px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.#updateLiveIndicator(),
    });

    // Retrieve last run verification code
    this.#lastRunCode = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('CHAIN_HEIST_LAST_RUN_CODE')
      : null;

    // Tabs: ALL-TIME and TODAY
    this.#createTabs(width / 2, 88);

    // Table Container for rows
    this.#tableContainer = this.add.container(0, 0);

    // Initial render
    this.#renderTable();

    // Live 10-second polling (with 30s idle pause)
    this.#stopPolling = leaderboard.startLedgerPolling(async () => {
      await this.#renderTable();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.#stopPolling) {
        this.#stopPolling();
        this.#stopPolling = null;
      }
    });

    // Footer instruction
    const btnY = 530;
    const newPlayerBtn = this.add.rectangle(width / 2, btnY, 480, 38, 0x140e32, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 1)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(width / 2, btnY, '[ENTER] NEW PLAYER · RESET RUN & RETURN TO TITLE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    newPlayerBtn.on('pointerdown', () => this.#resetAndReturnToTitle());

    this.tweens.add({
      targets: btnText,
      alpha: { from: 0.8, to: 1.0 },
      scale: { from: 0.98, to: 1.02 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  #updateLiveIndicator() {
    if (!this.#liveIndicatorText?.scene) return;
    const isOnline = leaderboard.isRemoteEnabled;
    const elapsedSec = Math.floor((Date.now() - this.#lastFetchTimestamp) / 1000);

    if (this.#isLoading) {
      this.#liveIndicatorText.setText('⟳ SYNCING CONSENSUS...').setColor('#FFD700');
    } else if (isOnline) {
      this.#liveIndicatorText.setText(`● LIVE • updated ${elapsedSec}s ago`).setColor('#00FF66');
    } else {
      this.#liveIndicatorText.setText('○ LOCAL/OFFLINE CONSENSUS').setColor('#8E8AAB');
    }
  }

  #createTabs(cx, cy) {
    const tabW = 140;
    const tabH = 26;

    const btnAll = this.add.rectangle(cx - 80, cy, tabW, tabH, 0x140e32, 0.9)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.8)
      .setInteractive({ useHandCursor: true });

    this.#tabAllText = this.add.text(cx - 80, cy, '▶ ALL-TIME', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btnAll.on('pointerdown', () => {
      if (this.#currentTab !== 'all') {
        this.#currentTab = 'all';
        this.#updateTabStyles();
        this.#renderTable();
      }
    });

    const btnToday = this.add.rectangle(cx + 80, cy, tabW, tabH, 0x0c0722, 0.9)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.4)
      .setInteractive({ useHandCursor: true });

    this.#tabTodayText = this.add.text(cx + 80, cy, 'TODAY', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#8E8AAB',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btnToday.on('pointerdown', () => {
      if (this.#currentTab !== 'today') {
        this.#currentTab = 'today';
        this.#updateTabStyles();
        this.#renderTable();
      }
    });
  }

  #updateTabStyles() {
    if (!this.#tabAllText || !this.#tabTodayText) return;
    if (this.#currentTab === 'all') {
      this.#tabAllText.setText('▶ ALL-TIME').setColor('#00FF66');
      this.#tabTodayText.setText('TODAY').setColor('#8E8AAB');
    } else {
      this.#tabAllText.setText('ALL-TIME').setColor('#8E8AAB');
      this.#tabTodayText.setText('▶ TODAY').setColor('#00FF66');
    }
  }

  async #renderTable() {
    if (!this.#tableContainer) return;
    this.#isLoading = true;
    this.#updateLiveIndicator();

    const width = this.scale.width;
    const tableX = width / 2;
    const tableStartY = 124;
    const tableW = 860;
    const rowH = 32;

    // Fetch entries
    let entries = [];
    try {
      entries = await leaderboard.getTop(50, this.#currentTab);
      this.#lastFetchTimestamp = Date.now();
    } catch {
      entries = [];
    }
    this.#isLoading = false;
    this.#updateLiveIndicator();

    if (entries.length < 5) {
      DEFAULT_SEEDS.forEach((seed) => {
        if (!entries.some((e) => e.name === seed.name)) {
          entries.push(seed);
        }
      });
      entries.sort((a, b) => b.score - a.score);
    }

    this.#tableContainer.removeAll(true);

    // Required Columns: RANK / NAME / SCORE / DISTRICTS / TOKENS / DATE
    const headY = tableStartY;
    const headBox = this.add.rectangle(tableX, headY, tableW, 26, 0x110b2e, 0.9)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.6);
    this.#tableContainer.add(headBox);

    const cols = [
      { text: 'RANK', x: tableX - 390, align: 0 },
      { text: 'NAME', x: tableX - 280, align: 0 },
      { text: 'SCORE', x: tableX - 60, align: 1 },
      { text: 'DISTRICTS', x: tableX + 50, align: 0.5 },
      { text: 'TOKENS', x: tableX + 190, align: 0.5 },
      { text: 'DATE', x: tableX + 380, align: 1 },
    ];

    cols.forEach((c) => {
      const hText = this.add.text(c.x, headY, c.text, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: '#FFD700',
        fontStyle: 'bold',
      }).setOrigin(c.align, 0.5);
      this.#tableContainer.add(hText);
    });

    const displayLimit = 10;
    const visibleEntries = entries.slice(0, displayLimit);
    let playerRank = -1;
    let playerEntry = null;

    if (this.#lastRunCode) {
      const pIdx = entries.findIndex(e => e.verificationCode === this.#lastRunCode || e.runCode === this.#lastRunCode);
      if (pIdx !== -1) {
        playerRank = pIdx + 1;
        playerEntry = entries[pIdx];
      }
    }

    // Render top entries
    visibleEntries.forEach((entry, idx) => {
      const ry = tableStartY + 28 + idx * rowH;
      const isYou = Boolean(this.#lastRunCode && (entry.verificationCode === this.#lastRunCode || entry.runCode === this.#lastRunCode));

      this.#renderRow(tableX, ry, tableW, rowH, idx + 1, entry, isYou);
    });

    // If player is outside top 10 (or top 50), pin "YOUR RANK" row at bottom
    if (playerEntry && playerRank > displayLimit) {
      const pinY = tableStartY + 28 + displayLimit * rowH + 6;
      this.#renderRow(tableX, pinY, tableW, rowH, playerRank, playerEntry, true, true);
    }
  }

  #renderRow(tableX, ry, tableW, rowH, rankNumber, entry, isYou = false, isPinned = false) {
    const rowBgCol = isYou ? 0x22134a : (rankNumber % 2 === 0 ? 0x0c0722 : 0x080418);
    const rowBorderCol = isYou ? 0x00FF66 : (isPinned ? 0xFFD700 : 0x1b1435);
    const rowBorderWidth = isYou ? 2 : 1;

    const rowBox = this.add.rectangle(tableX, ry, tableW, rowH - 4, rowBgCol, 0.95)
      .setStrokeStyle(rowBorderWidth, rowBorderCol, isYou ? 1.0 : 0.6);
    this.#tableContainer.add(rowBox);

    if (isYou) {
      this.tweens.add({
        targets: rowBox,
        alpha: { from: 0.82, to: 1.0 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // 1. RANK
    let rankText = `#${rankNumber}`;
    let rankColor = '#A8A4C4';
    if (rankNumber === 1) {
      rankText = '👑 #1';
      rankColor = '#FFD700';
    } else if (rankNumber === 2) {
      rankText = '  #2';
      rankColor = '#D9E2EC';
    } else if (rankNumber === 3) {
      rankText = '  #3';
      rankColor = '#CD7F32';
    }

    const rTextObj = this.add.text(tableX - 390, ry, rankText, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: rankNumber === 1 ? '14px' : '12px',
      color: rankColor,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.#tableContainer.add(rTextObj);

    // 2. NAME
    const hunterColor = HUNTER_COLORS[entry.hunter] || (isYou ? '#00FF66' : '#00FFFF');
    const nameStr = (entry.name || 'ANON').toUpperCase();
    const nameObj = this.add.text(tableX - 280, ry, isYou ? `${nameStr} [YOU]` : nameStr, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: isYou ? '#00FF66' : hunterColor,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.#tableContainer.add(nameObj);

    // 3. SCORE
    const scoreStr = String(entry.score).padStart(6, '0');
    const scoreObj = this.add.text(tableX - 60, ry, scoreStr, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.#tableContainer.add(scoreObj);

    // 4. DISTRICTS
    const distCount = entry.districts !== undefined ? entry.districts : (entry.cleared?.length || 0);
    const distStr = `${distCount}/${MAX_DISTRICTS}`;
    const distObj = this.add.text(tableX + 50, ry, distStr, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: distCount >= MAX_DISTRICTS ? '#00FF66' : '#8E8AAB',
    }).setOrigin(0.5, 0.5);
    this.#tableContainer.add(distObj);

    // 5. TOKENS
    const tokenCount = entry.tokens || 0;
    const tokenObj = this.add.text(tableX + 190, ry, `${tokenCount}/10`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: tokenCount > 0 ? '#3FF0FF' : '#555566',
    }).setOrigin(0.5, 0.5);
    this.#tableContainer.add(tokenObj);

    // 6. DATE
    const d = new Date(entry.timestamp || Date.now());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dateStr = `${m}/${day} ${hh}:${mm}`;

    const dateObj = this.add.text(tableX + 380, ry, dateStr, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
    }).setOrigin(1, 0.5);
    this.#tableContainer.add(dateObj);
  }

  update() {
    super.update();
    if (this.#isConfirmed || this._controls.isInputLocked) {
      return;
    }

    if (this._controls.wasEnterKeyPressed() || this._controls.wasSpaceKeyPressed()) {
      this.#resetAndReturnToTitle();
    }
  }

  #resetAndReturnToTitle() {
    this.#isConfirmed = true;

    runState.resetToDefaults();
    runState.save();

    dataManager.store.set(DATA_MANAGER_STORE_KEYS.GAME_STARTED, false);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.TITLE_SCENE);
    });
  }
}
