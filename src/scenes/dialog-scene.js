import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { animateText } from '../utils/text-utils.js';
import { DATA_MANAGER_STORE_KEYS, dataManager } from '../utils/data-manager.js';
import { UI_ASSET_KEYS } from '../assets/asset-keys.js';
import { MENU_COLOR } from '../config.js';
import { exhaustiveGuard } from '../utils/guard.js';

/** @type {Phaser.Types.GameObjects.Text.TextStyle} */
const UI_TEXT_STYLE = Object.freeze({
  fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
  color: 'white',
  fontSize: '32px',
  wordWrap: { width: 0 },
});

export class DialogScene extends BaseScene {
  /** @type {number} */
  #padding;
  /** @type {number} */
  #width;
  /** @type {number} */
  #height;
  /** @type {Phaser.GameObjects.Container} */
  #container;
  /** @type {boolean} */
  #isVisible;
  /** @type {Phaser.GameObjects.Image} */
  #userInputCursor;
  /** @type {Phaser.Tweens.Tween} */
  #userInputCursorTween;
  /** @type {Phaser.GameObjects.Text[]} */
  #tokenObjects;
  /** @type {Phaser.Time.TimerEvent | undefined} */
  #textTimer;
  /** @type {boolean} */
  #textAnimationPlaying;
  /** @type {string[]} */
  #messagesToShow;
  /** @type {(() => void) | undefined} */
  #finishCallback;
  /** @type {(() => void) | undefined} */
  #onMessageComplete;
  /** @type {{ textObj: Phaser.GameObjects.Text; fullText: string }[]} */
  #tokenData;

  constructor() {
    super({
      key: SCENE_KEYS.DIALOG_SCENE,
    });
  }

  /** @type {boolean} */
  get isVisible() {
    return this.#isVisible;
  }

  /** @type {boolean} */
  get isAnimationPlaying() {
    return this.#textAnimationPlaying;
  }

  /** @type {boolean} */
  get moreMessagesToShow() {
    return this.#messagesToShow.length > 0;
  }

  /**
   * @returns {void}
   */
  create() {
    this.#padding = 90;
    this.#width = 1280 - this.#padding * 2;
    this.#height = 124;
    this.#textAnimationPlaying = false;
    this.#messagesToShow = [];
    this.#tokenObjects = [];
    this.cameras.main.setZoom(0.8);

    // Dark navy panel (#120A22), cyan border (#3FF0FF), magenta highlights (#FF3FD0)
    const panel = this.add
      .rectangle(0, 0, this.#width, this.#height, 0x120A22, 0.95)
      .setOrigin(0)
      .setStrokeStyle(3.5, 0x3FF0FF, 1);

    // Magenta decorative cyber corner notches
    const cornerGfx = this.add.graphics();
    cornerGfx.lineStyle(2, 0xFF3FD0, 0.95);
    // Top-left
    cornerGfx.lineBetween(0, 0, 18, 0);
    cornerGfx.lineBetween(0, 0, 0, 18);
    // Bottom-right
    cornerGfx.lineBetween(this.#width, this.#height, this.#width - 18, this.#height);
    cornerGfx.lineBetween(this.#width, this.#height, this.#width, this.#height - 18);

    // Cyber terminal header tag
    const headerTag = this.add.text(18, -11, '▶ OPERATIVE LINK // 2099', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#FF3FD0',
      fontStyle: 'bold',
      backgroundColor: '#120A22',
      padding: { x: 4, y: 1 },
    });

    this.#container = this.add.container(0, 0, [panel, cornerGfx, headerTag]);

    this.#createPlayerInputCursor();
    this.hideDialogModal();
    this.scene.bringToTop();
  }

  /**
   * @param {string[]} messages
   * @param {(() => void)} [callback]
   * @returns {void}
   */
  showDialogModal(messages, callback) {
    this.#messagesToShow = [...messages];
    this.#finishCallback = callback;

    const { x, bottom } = this.cameras.main.worldView;
    const startX = x + this.#padding;
    const startY = bottom - this.#height - this.#padding / 4;

    this.#container.setPosition(startX, startY);
    this.#userInputCursorTween.restart();
    this.#container.setAlpha(1);
    this.#isVisible = true;

    this.showNextMessage();
  }

  /**
   * @returns {void}
   */
  showNextMessage() {
    if (this.#messagesToShow.length === 0) {
      if (this.#finishCallback) {
        const cb = this.#finishCallback;
        this.#finishCallback = undefined;
        cb();
      }
      return;
    }

    const currentMsg = this.#messagesToShow.shift();
    this.#displayAnimatedMessage(currentMsg, () => {
      if (this.#messagesToShow.length === 0 && this.#finishCallback) {
        const cb = this.#finishCallback;
        this.#finishCallback = undefined;
        cb();
      }
    });
  }

  /**
   * Displays message with typewriter animation, coloring numbers in gold (#F5B82E)
   * and text in readable white (#FFFFFF)
   * @param {string} message
   * @param {() => void} [onComplete]
   * @returns {void}
   */
  #displayAnimatedMessage(message, onComplete) {
    // Clear previous token objects
    this.#tokenObjects.forEach((obj) => obj.destroy());
    this.#tokenObjects = [];
    this.#tokenData = [];
    this.#onMessageComplete = onComplete;

    // Tokenize message into digits vs non-digits
    const tokens = message.match(/\d+|\D+/g) || [message];
    let curX = 18;
    let curY = 16;
    const maxWidth = this.#width - 36;
    const lineSpacing = 36;

    const charsToAnimate = [];

    tokens.forEach((tok) => {
      const isNum = /\d+/.test(tok);
      const color = isNum ? '#F5B82E' : '#FFFFFF';
      const fontStyle = isNum ? 'bold' : 'normal';

      // Measure token
      const dummy = this.add.text(0, 0, tok, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '30px',
        color: color,
        fontStyle: fontStyle,
      }).setVisible(false);

      const tokWidth = dummy.width;
      dummy.destroy();

      if (curX + tokWidth > maxWidth && curX > 18) {
        curX = 18;
        curY += lineSpacing;
      }

      const textObj = this.add.text(curX, curY, '', {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '30px',
        color: color,
        fontStyle: fontStyle,
        stroke: '#04020a',
        strokeThickness: 3,
      });

      this.#container.add(textObj);
      this.#tokenObjects.push(textObj);
      this.#tokenData.push({ textObj, fullText: tok });

      for (let c = 0; c < tok.length; c++) {
        charsToAnimate.push({ textObj, char: tok[c] });
      }

      curX += tokWidth;
    });

    // Animate characters
    this.#textAnimationPlaying = true;
    let charIdx = 0;
    const totalChars = charsToAnimate.length;

    if (this.#textTimer) {
      this.#textTimer.remove();
    }

    this.#textTimer = this.time.addEvent({
      delay: dataManager.getAnimatedTextSpeed() || 25,
      repeat: totalChars - 1,
      callback: () => {
        if (charIdx < totalChars) {
          const item = charsToAnimate[charIdx];
          item.textObj.text += item.char;
          charIdx++;
        }
        if (charIdx >= totalChars) {
          this.#textAnimationPlaying = false;
          if (this.#onMessageComplete) {
            const cb = this.#onMessageComplete;
            this.#onMessageComplete = undefined;
            cb();
          }
        }
      },
    });
  }

  /**
   * Immediately finishes typewriter text animation and displays complete message
   * @returns {void}
   */
  completeAnimation() {
    if (!this.#textAnimationPlaying) return;
    if (this.#textTimer) {
      this.#textTimer.remove();
      this.#textTimer = undefined;
    }
    this.#tokenData?.forEach((item) => {
      item.textObj.setText(item.fullText);
    });
    this.#textAnimationPlaying = false;
    if (this.#onMessageComplete) {
      const cb = this.#onMessageComplete;
      this.#onMessageComplete = undefined;
      cb();
    }
  }

  update() {
    super.update();
    if (this._controls?.wasSpaceKeyPressed() || this._controls?.wasEnterKeyPressed()) {
      if (this.#textAnimationPlaying) {
        this.completeAnimation();
      }
    }
  }

  /**
   * @returns {void}
   */
  hideDialogModal() {
    this.#container.setAlpha(0);
    this.#userInputCursorTween.pause();
    this.#isVisible = false;
  }

  /**
   * @returns {void}
   */
  #createPlayerInputCursor() {
    const y = this.#height - 24;
    this.#userInputCursor = this.add.image(this.#width - 16, y, UI_ASSET_KEYS.CURSOR);
    this.#userInputCursor.setAngle(90).setScale(4.5, 2);
    // Magenta highlight (#FF3FD0) for dialog cursor
    this.#userInputCursor.setTint(0xFF3FD0);

    this.#userInputCursorTween = this.add.tween({
      delay: 0,
      duration: 500,
      repeat: -1,
      y: {
        from: y,
        start: y,
        to: y + 6,
      },
      targets: this.#userInputCursor,
    });
    this.#userInputCursorTween.pause();
    this.#container.add(this.#userInputCursor);
  }

  /**
   * @returns {{ main: number; border: number}}
   */
  #getMenuColorsFromDataManager() {
    /** @type {import('../common/options.js').MenuColorOptions} */
    const chosenMenuColor = dataManager.store.get(DATA_MANAGER_STORE_KEYS.OPTIONS_MENU_COLOR);
    if (chosenMenuColor === undefined) {
      return MENU_COLOR[1];
    }

    switch (chosenMenuColor) {
      case 0:
        return MENU_COLOR[1];
      case 1:
        return MENU_COLOR[2];
      case 2:
        return MENU_COLOR[3];
      default:
        exhaustiveGuard(chosenMenuColor);
    }
  }
}
