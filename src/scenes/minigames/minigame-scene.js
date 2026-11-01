import Phaser from '../../lib/phaser.js';
import { BaseScene } from '../base-scene.js';
import { SCENE_KEYS } from '../scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../../assets/font-keys.js';
import { runState } from '../../state/run-state.js';

export class PlaceholderMiniGameScene extends BaseScene {
  /** @type {object} */
  _data = {};
  /** @type {string} */
  _title = 'MINI-GAME';
  /** @type {string} */
  _subtitle = 'DISTRICT CYBER-PROTOCOL';
  /** @type {string} */
  _accentColor = '#3FF0FF';
  /** @type {number} */
  _accentHex = 0x3FF0FF;
  /** @type {boolean} */
  #hasHandledInput = false;

  constructor(config) {
    super(config);
  }

  init(data) {
    super.init(data);
    this._data = data || {};
    this.#hasHandledInput = false;
  }

  create() {
    super.create();
    this.cameras.main.setBackgroundColor('#070410');
    this.cameras.main.fadeIn(300);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Grid backdrop
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1d1538, 0.45);
    for (let x = 0; x < this.scale.width; x += 32) {
      grid.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 32) {
      grid.lineBetween(0, y, this.scale.width, y);
    }

    // Top Header Banner
    this.add.rectangle(cx, 55, 780, 60, 0x0c081e, 0.95)
      .setStrokeStyle(2, this._accentHex, 0.9);

    this.add.text(cx, 44, `// PROTOCOL: ${this._title} //`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '24px',
      color: this._accentColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 70, this._subtitle, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // Center Terminal Card
    const cardW = 560;
    const cardH = 290;
    this.add.rectangle(cx, cy + 20, cardW, cardH, 0x090517, 0.96)
      .setStrokeStyle(2, this._accentHex, 0.85);

    this.add.text(cx, cy - 85, 'MINI-GAME PLACEHOLDER INTERFACE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 55, `OPERATIVE: ${runState.name}  •  LIVES: ${'♥ '.repeat(runState.lives)}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#8E8AAB',
    }).setOrigin(0.5);

    // Win Button
    const winBtn = this.add.rectangle(cx, cy - 5, 420, 48, 0x07281c, 0.95)
      .setStrokeStyle(2, 0x00FF66, 1)
      .setInteractive({ useHandCursor: true });

    const winText = this.add.text(cx, cy - 5, '▶ PRESS [W] TO WIN (OVERCLOCK NODE)', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    winBtn.on('pointerdown', () => this.#handleWin());

    // Lose Button
    const loseBtn = this.add.rectangle(cx, cy + 55, 420, 48, 0x2b0716, 0.95)
      .setStrokeStyle(2, 0xFF3366, 1)
      .setInteractive({ useHandCursor: true });

    const loseText = this.add.text(cx, cy + 55, '▶ PRESS [L] TO LOSE (SYSTEM COLLAPSE)', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FF3366',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    loseBtn.on('pointerdown', () => this.#handleLose());

    // Footer Info
    this.add.text(cx, cy + 125, 'DEBUG TESTING MODE  •  USE [W] OR [L] ON KEYBOARD OR CLICK BUTTONS', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#716C8E',
    }).setOrigin(0.5);

    // Keyboard bindings for W and L
    this.input.keyboard?.on('keydown-W', () => this.#handleWin());
    this.input.keyboard?.on('keydown-L', () => this.#handleLose());
  }

  #handleWin() {
    if (this.#hasHandledInput) return;
    this.#hasHandledInput = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
        ...this._data,
        mode: 'win',
      });
    });
  }

  #handleLose() {
    if (this.#hasHandledInput) return;
    this.#hasHandledInput = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
        ...this._data,
        mode: 'lose',
      });
    });
  }
}

export { BlockFlyerScene } from './block-flyer-scene.js';


export { VaultRunScene } from './vault-run-scene.js';


export { ChainSnakeScene } from './chain-snake-scene.js';


