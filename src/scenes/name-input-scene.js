import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { dataManager } from '../utils/data-manager.js';
import { runState } from '../state/run-state.js';
import { DIRECTION } from '../common/direction.js';

const GRID_CHARS = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3'],
  ['4', '5', '6', '7', '8', '9', '_', 'DEL', 'OK'],
];

export class NameInputScene extends BaseScene {
  /** @type {string} */
  #playerName = 'HUNTER';
  /** @type {number} */
  #gridRow = 0;
  /** @type {number} */
  #gridCol = 0;
  /** @type {Phaser.GameObjects.Text} */
  #nameDisplayText;
  /** @type {Phaser.GameObjects.Text} */
  #charCountText;
  /** @type {Phaser.GameObjects.Text} */
  #statusMessageText;
  /** @type {Phaser.GameObjects.Rectangle[][]} */
  #tileBorders = [];
  /** @type {Phaser.GameObjects.Text[][]} */
  #tileTexts = [];
  /** @type {boolean} */
  #isConfirmed = false;

  constructor() {
    super({
      key: SCENE_KEYS.NAME_INPUT_SCENE,
    });
  }

  create() {
    super.create();
    this.#playerName = 'HUNTER';
    this.#gridRow = 0;
    this.#gridCol = 0;
    this.#isConfirmed = false;
    this.#tileBorders = [];
    this.#tileTexts = [];

    this.cameras.main.setBackgroundColor('#070410');
    this.cameras.main.fadeIn(400);

    // Grid backdrop
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1b1435, 0.4);
    for (let x = 0; x < this.scale.width; x += 32) {
      gridGraphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 32) {
      gridGraphics.lineBetween(0, y, this.scale.width, y);
    }

    // Header banner
    this.add.rectangle(this.scale.width / 2, 45, 860, 60, 0x0f0b24, 0.9)
      .setStrokeStyle(2, 0x3FF0FF);

    this.add.text(this.scale.width / 2, 32, 'CHAIN HEIST 2099 // HUNTER REGISTRATION', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '24px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, 56, 'REGISTER YOUR LEDGER ALIAS (3–12 CHARACTERS: A–Z, 0–9, _)', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#A8A4C4',
    }).setOrigin(0.5);

    // Left sidebar: chosen cat preview
    const catKey = dataManager.getPlayerCat();
    const sideBox = this.add.rectangle(140, 290, 190, 360, 0x120d2a, 0.9)
      .setStrokeStyle(2, 0x3FF0FF, 0.7);

    this.add.text(140, 130, 'ASSIGNED UNIT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const catSprite = this.add.image(140, 235, catKey)
      .setScale(0.9)
      .setOrigin(0.5, 0.75);

    this.tweens.add({
      targets: catSprite,
      y: { from: 235, to: 228 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(140, 315, catKey.toUpperCase(), {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(140, 338, 'STATUS: SYNCED', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#00FF66',
    }).setOrigin(0.5);

    // Name Display Panel
    const nameBoxX = 600;
    const nameBoxY = 135;
    this.add.rectangle(nameBoxX, nameBoxY, 640, 68, 0x100a26, 0.95)
      .setStrokeStyle(2, 0xFFD700);

    this.add.text(nameBoxX - 300, nameBoxY, 'ALIAS :', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '20px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.#nameDisplayText = this.add.text(nameBoxX - 210, nameBoxY, this.#playerName, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '32px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.#charCountText = this.add.text(nameBoxX + 280, nameBoxY, `(${this.#playerName.length}/12)`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#A09CB8',
    }).setOrigin(1, 0.5);

    // Blinking cursor after name
    const cursorBar = this.add.rectangle(nameBoxX - 200, nameBoxY, 3, 30, 0x3FF0FF);
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        cursorBar.setVisible(!cursorBar.visible);
        cursorBar.setX(this.#nameDisplayText.x + this.#nameDisplayText.width + 6);
      },
    });

    // Status / Warning message
    this.#statusMessageText = this.add.text(nameBoxX, nameBoxY + 48, '', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#00FF66',
    }).setOrigin(0.5);

    // Letter Grid Layout
    const gridStartX = 320;
    const gridStartY = 220;
    const cellWidth = 52;
    const cellHeight = 44;
    const cellSpacingX = 14;
    const cellSpacingY = 12;

    GRID_CHARS.forEach((row, r) => {
      this.#tileBorders[r] = [];
      this.#tileTexts[r] = [];

      row.forEach((char, c) => {
        const isWide = char === 'DEL' || char === 'OK';
        const currentWidth = isWide ? cellWidth * 1.5 : cellWidth;
        const xOffset = isWide && char === 'OK' ? 26 : 0;
        const cellX = gridStartX + c * (cellWidth + cellSpacingX) + currentWidth / 2 + xOffset;
        const cellY = gridStartY + r * (cellHeight + cellSpacingY) + cellHeight / 2;

        const tileBg = this.add.rectangle(cellX, cellY, currentWidth, cellHeight, 0x140f30, 0.85);
        tileBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.#gridRow = r;
          this.#gridCol = c;
          this.#updateGridUI();
          this.#handleTileAction();
        });
        const tileBorder = this.add.rectangle(cellX, cellY, currentWidth, cellHeight)
          .setStrokeStyle(1, 0x47397b);

        let labelColor = '#FFFFFF';
        if (char === 'DEL') labelColor = '#FF5577';
        if (char === 'OK') labelColor = '#00FF66';

        const tileText = this.add.text(cellX, cellY, char, {
          fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
          fontSize: isWide ? '16px' : '20px',
          color: labelColor,
          fontStyle: 'bold',
        }).setOrigin(0.5);

        this.#tileBorders[r][c] = tileBorder;
        this.#tileTexts[r][c] = tileText;
      });
    });

    // Footer instruction bar
    const footerBg = this.add.rectangle(this.scale.width / 2, 520, 780, 42, 0x0c081e, 0.9)
      .setStrokeStyle(1, 0x3FF0FF, 0.6);

    this.add.text(this.scale.width / 2, 520, 'ARROWS : MOVE GRID   •   SPACE / ENTER : SELECT   •   TYPE KEYBOARD DIRECTLY', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Direct keyboard listener
    this.input.keyboard.on('keydown', (event) => {
      if (this.#isConfirmed) return;
      const key = event.key.toUpperCase();

      if (key === 'BACKSPACE') {
        this.#deleteChar();
        return;
      }
      if (key === 'ENTER') {
        if (this.#playerName.length >= 3) {
          this.#confirmName();
        } else {
          this.#showWarning('MINIMUM 3 CHARACTERS REQUIRED');
        }
        return;
      }
      if (/^[A-Z0-9_]$/.test(key)) {
        this.#appendChar(key);
      }
    });

    this.#updateGridUI();
    this.#updateNameDisplay();
  }

  update() {
    super.update();
    if (this.#isConfirmed || this._controls.isInputLocked) {
      return;
    }

    const dir = this._controls.getDirectionKeyJustPressed();
    const maxRows = GRID_CHARS.length;
    const maxCols = GRID_CHARS[this.#gridRow].length;

    if (dir === DIRECTION.LEFT) {
      this.#gridCol = (this.#gridCol - 1 + maxCols) % maxCols;
      this.#updateGridUI();
    } else if (dir === DIRECTION.RIGHT) {
      this.#gridCol = (this.#gridCol + 1) % maxCols;
      this.#updateGridUI();
    } else if (dir === DIRECTION.UP) {
      this.#gridRow = (this.#gridRow - 1 + maxRows) % maxRows;
      const rowLen = GRID_CHARS[this.#gridRow].length;
      if (this.#gridCol >= rowLen) this.#gridCol = rowLen - 1;
      this.#updateGridUI();
    } else if (dir === DIRECTION.DOWN) {
      this.#gridRow = (this.#gridRow + 1) % maxRows;
      const rowLen = GRID_CHARS[this.#gridRow].length;
      if (this.#gridCol >= rowLen) this.#gridCol = rowLen - 1;
      this.#updateGridUI();
    }

    if (this._controls.wasSpaceKeyPressed()) {
      this.#handleTileAction();
    }
  }

  #handleTileAction() {
    const char = GRID_CHARS[this.#gridRow][this.#gridCol];
    if (char === 'DEL') {
      this.#deleteChar();
    } else if (char === 'OK') {
      if (this.#playerName.length >= 3) {
        this.#confirmName();
      } else {
        this.#showWarning('MINIMUM 3 CHARACTERS REQUIRED');
      }
    } else {
      this.#appendChar(char);
    }
  }

  #appendChar(char) {
    if (this.#playerName.length < 12) {
      this.#playerName += char;
      this.#updateNameDisplay();
    } else {
      this.#showWarning('MAXIMUM 12 CHARACTERS REACHED');
    }
  }

  #deleteChar() {
    if (this.#playerName.length > 0) {
      this.#playerName = this.#playerName.slice(0, -1);
      this.#updateNameDisplay();
    }
  }

  #updateNameDisplay() {
    this.#nameDisplayText.setText(this.#playerName);
    this.#charCountText.setText(`(${this.#playerName.length}/12)`);

    if (this.#playerName.length < 3) {
      this.#statusMessageText.setText('NEED AT LEAST 3 CHARACTERS').setColor('#FF5577');
    } else {
      this.#statusMessageText.setText('VALID ALIAS • SELECT OK OR PRESS ENTER TO PROCEED').setColor('#00FF66');
    }
  }

  #showWarning(msg) {
    this.#statusMessageText.setText(msg).setColor('#FF3366');
    this.tweens.add({
      targets: this.#statusMessageText,
      scale: { from: 1.1, to: 1 },
      duration: 150,
    });
  }

  #updateGridUI() {
    GRID_CHARS.forEach((row, r) => {
      row.forEach((char, c) => {
        const border = this.#tileBorders[r][c];
        const text = this.#tileTexts[r][c];
        const isSelected = r === this.#gridRow && c === this.#gridCol;

        if (isSelected) {
          border.setStrokeStyle(3, 0x3FF0FF, 1);
          text.setScale(1.2);
        } else {
          border.setStrokeStyle(1, 0x47397b, 0.7);
          text.setScale(1);
        }
      });
    });
  }

  #confirmName() {
    this.#isConfirmed = true;
    this._controls.lockInput = true;

    dataManager.setPlayerName(this.#playerName);
    runState.initNewRun(this.#playerName, dataManager.getPlayerCat());

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.INTRO_SCENE);
    });
  }
}

