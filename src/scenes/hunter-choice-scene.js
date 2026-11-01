import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { dataManager } from '../utils/data-manager.js';
import { DIRECTION } from '../common/direction.js';

const HUNTER_UNITS = [
  {
    key: 'cat-1',
    name: 'CYAN UNIT',
    title: 'RAPID INFILTRATOR',
    colorHex: 0x00ffff,
    colorStr: '#00FFFF',
    desc: 'High velocity node sprinter.\nBypasses perimeter firewalls.',
  },
  {
    key: 'cat-2',
    name: 'MAGENTA UNIT',
    title: 'FIREWALL BREAKER',
    colorHex: 0xff00ff,
    colorStr: '#FF00FF',
    desc: 'Overclocked attack payload.\nCracks hostile consensus nodes.',
  },
  {
    key: 'cat-3',
    name: 'VIOLET UNIT',
    title: 'CIPHER PHANTOM',
    colorHex: 0x9d4edd,
    colorStr: '#B366FF',
    desc: 'Zero-knowledge stealth spec.\nInvisible to ape monitoring daemons.',
  },
  {
    key: 'cat-4',
    name: 'GOLD UNIT',
    title: 'LEDGER GUARDIAN',
    colorHex: 0xffd700,
    colorStr: '#FFD700',
    desc: 'Cryptographic fortress.\nMaximum defense & gas optimization.',
  },
];

export class HunterChoiceScene extends BaseScene {
  /** @type {number} */
  #selectedIndex = 0;
  /** @type {Phaser.GameObjects.Container[]} */
  #cardContainers = [];
  /** @type {Phaser.GameObjects.Rectangle[]} */
  #cardBorders = [];
  /** @type {Phaser.GameObjects.Image[]} */
  #catSprites = [];
  /** @type {boolean} */
  #isConfirmed = false;

  constructor() {
    super({
      key: SCENE_KEYS.HUNTER_CHOICE_SCENE,
    });
  }

  create() {
    super.create();
    this.#selectedIndex = 0;
    this.#isConfirmed = false;
    this.#cardContainers = [];
    this.#cardBorders = [];
    this.#catSprites = [];

    this.cameras.main.setBackgroundColor('#070410');
    this.cameras.main.fadeIn(400);

    // Decorative grid lines
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1b1435, 0.4);
    for (let x = 0; x < this.scale.width; x += 32) {
      gridGraphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 32) {
      gridGraphics.lineBetween(0, y, this.scale.width, y);
    }

    // Header banner
    this.add.rectangle(this.scale.width / 2, 48, 860, 68, 0x0f0b24, 0.9)
      .setStrokeStyle(2, 0x3FF0FF);

    this.add.text(this.scale.width / 2, 34, 'CHAIN HEIST 2099 // HUNTER UNIT SELECT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '26px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, 60, 'SELECT YOUR PROTOCOL INFILTRATOR UNIT (CYAN / MAGENTA / VIOLET / GOLD)', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // Render 4 Cat Cards
    const cardWidth = 220;
    const cardHeight = 340;
    const spacing = 22;
    const totalWidth = 4 * cardWidth + 3 * spacing;
    const startX = (this.scale.width - totalWidth) / 2 + cardWidth / 2;
    const cardY = 275;

    HUNTER_UNITS.forEach((unit, idx) => {
      const cx = startX + idx * (cardWidth + spacing);
      const container = this.add.container(cx, cardY);

      // Card Background
      const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x120d2a, 0.85);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.#selectedIndex === idx) {
          this.#confirmChoice();
        } else {
          this.#selectedIndex = idx;
          this.#updateSelectionUI();
        }
      });
      container.add(bg);

      // Card Border
      const border = this.add.rectangle(0, 0, cardWidth, cardHeight)
        .setStrokeStyle(idx === 0 ? 3 : 1, unit.colorHex, idx === 0 ? 1 : 0.4);
      container.add(border);
      this.#cardBorders.push(border);

      // Unit Name Header
      const headerText = this.add.text(0, -140, unit.name, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '20px',
        color: unit.colorStr,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(headerText);

      // Role tag
      const roleText = this.add.text(0, -118, unit.title, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '11px',
        color: '#FFFFFF',
      }).setOrigin(0.5);
      container.add(roleText);

      // Pedestal
      const pedestal = this.add.ellipse(0, 35, 110, 26, 0x1d1544, 0.9)
        .setStrokeStyle(1, unit.colorHex, 0.6);
      container.add(pedestal);

      // Cat Sprite
      const cat = this.add.image(0, 5, unit.key)
        .setScale(0.85)
        .setOrigin(0.5, 0.75);
      container.add(cat);
      this.#catSprites.push(cat);

      // Description
      const descText = this.add.text(0, 95, unit.desc, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '12px',
        color: '#D4CEE8',
        align: 'center',
        wordWrap: { width: cardWidth - 24 },
      }).setOrigin(0.5);
      container.add(descText);

      // Selection status tag
      const selectTag = this.add.text(0, 142, idx === 0 ? '▶ ACTIVE' : 'PRESS SELECT', {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '13px',
        color: idx === 0 ? unit.colorStr : '#5A5478',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      selectTag.setName('selectTag');
      container.add(selectTag);

      this.#cardContainers.push(container);
    });

    // Gentle idle floating on all cats
    this.#catSprites.forEach((cat, idx) => {
      this.tweens.add({
        targets: cat,
        y: { from: 5, to: 0 },
        duration: 900 + idx * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // Bottom Navigation Help
    const footerBg = this.add.rectangle(this.scale.width / 2, 515, 680, 44, 0x0c081e, 0.9)
      .setStrokeStyle(1, 0x3FF0FF, 0.6);

    this.add.text(this.scale.width / 2, 515, '◄ / ► ARROW KEYS : CHOOSE UNIT     •     SPACE / ENTER : CONFIRM', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.#updateSelectionUI();
  }

  update() {
    super.update();
    if (this.#isConfirmed || this._controls.isInputLocked) {
      return;
    }

    const direction = this._controls.getDirectionKeyJustPressed();
    if (direction === DIRECTION.LEFT) {
      this.#selectedIndex = (this.#selectedIndex - 1 + HUNTER_UNITS.length) % HUNTER_UNITS.length;
      this.#updateSelectionUI();
    } else if (direction === DIRECTION.RIGHT) {
      this.#selectedIndex = (this.#selectedIndex + 1) % HUNTER_UNITS.length;
      this.#updateSelectionUI();
    }

    if (this._controls.wasSpaceKeyPressed() || this._controls.wasEnterKeyPressed()) {
      this.#confirmChoice();
    }
  }

  #updateSelectionUI() {
    HUNTER_UNITS.forEach((unit, idx) => {
      const isSelected = idx === this.#selectedIndex;
      const border = this.#cardBorders[idx];
      const container = this.#cardContainers[idx];
      const selectTag = /** @type {Phaser.GameObjects.Text | null} */ (container.getByName('selectTag'));

      if (isSelected) {
        border.setStrokeStyle(4, unit.colorHex, 1);
        container.setScale(1.04);
        if (selectTag) {
          selectTag.setText('▶ SELECTED UNIT ◀');
          selectTag.setColor(unit.colorStr);
        }
      } else {
        border.setStrokeStyle(1, unit.colorHex, 0.35);
        container.setScale(0.97);
        if (selectTag) {
          selectTag.setText('SELECT');
          selectTag.setColor('#5A5478');
        }
      }
    });
  }

  #confirmChoice() {
    this.#isConfirmed = true;
    this._controls.lockInput = true;

    const chosen = HUNTER_UNITS[this.#selectedIndex];
    dataManager.setPlayerCat(chosen.key);

    // Pulse selected card
    const selectedContainer = this.#cardContainers[this.#selectedIndex];
    this.tweens.add({
      targets: selectedContainer,
      scale: 1.1,
      duration: 250,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start(SCENE_KEYS.NAME_INPUT_SCENE);
        });
      },
    });
  }
}

