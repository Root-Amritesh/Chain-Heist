import Phaser from '../lib/phaser.js';
import { DIRECTION } from '../common/direction.js';

export class Controls {
  /** @type {Phaser.Scene} */
  #scene;
  /** @type {Phaser.Types.Input.Keyboard.CursorKeys | undefined} */
  #cursorKeys;
  /** @type {boolean} */
  #lockPlayerInput;
  /** @type {Phaser.Input.Keyboard.Key | undefined} */
  #enterKey;
  /** @type {Phaser.Input.Keyboard.Key | undefined} */
  #fKey;
  /** @type {{ up: Phaser.Input.Keyboard.Key, down: Phaser.Input.Keyboard.Key, left: Phaser.Input.Keyboard.Key, right: Phaser.Input.Keyboard.Key } | undefined} */
  #wasdKeys;

  /**
   * @param {Phaser.Scene} scene the Phaser 3 Scene the cursor keys will be created in
   */
  constructor(scene) {
    this.#scene = scene;
    this.#cursorKeys = this.#scene.input.keyboard?.createCursorKeys();
    this.#enterKey = this.#scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.#fKey = this.#scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.#wasdKeys = this.#scene.input.keyboard ? {
      up: this.#scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.#scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.#scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.#scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    } : undefined;
    this.#lockPlayerInput = false;
  }

  /** @type {boolean} */
  get isInputLocked() {
    return this.#lockPlayerInput;
  }

  /** @param {boolean} val the value that will be assigned */
  set lockInput(val) {
    this.#lockPlayerInput = val;
  }

  /** @returns {boolean} */
  wasEnterKeyPressed() {
    if (this.#enterKey === undefined) {
      return false;
    }
    return Phaser.Input.Keyboard.JustDown(this.#enterKey);
  }

  /** @returns {boolean} */
  wasSpaceKeyPressed() {
    if (this.#cursorKeys === undefined) {
      return false;
    }
    return Phaser.Input.Keyboard.JustDown(this.#cursorKeys.space);
  }

  /** @returns {boolean} */
  wasBackKeyPressed() {
    if (this.#cursorKeys === undefined) {
      return false;
    }
    return Phaser.Input.Keyboard.JustDown(this.#cursorKeys.shift);
  }

  /** @returns {boolean} */
  wasFKeyPressed() {
    if (this.#fKey === undefined) {
      return false;
    }
    return Phaser.Input.Keyboard.JustDown(this.#fKey);
  }

  /**
   * Returns if the shift key is currently being held down.
   * @returns {boolean}
   */
  isShiftKeyDown() {
    if (this.#cursorKeys === undefined) {
      return false;
    }
    return this.#cursorKeys.shift.isDown;
  }

  /** @returns {{ x: number, y: number, isRunning: boolean }} */
  getMovementVector() {
    if (this.#cursorKeys === undefined) {
      return { x: 0, y: 0, isRunning: false };
    }

    let vx = 0;
    let vy = 0;
    if (this.#cursorKeys.left.isDown || this.#wasdKeys?.left.isDown) {
      vx -= 1;
    }
    if (this.#cursorKeys.right.isDown || this.#wasdKeys?.right.isDown) {
      vx += 1;
    }
    if (this.#cursorKeys.up.isDown || this.#wasdKeys?.up.isDown) {
      vy -= 1;
    }
    if (this.#cursorKeys.down.isDown || this.#wasdKeys?.down.isDown) {
      vy += 1;
    }

    // Normalize diagonal movement so diagonals are not 1.414x faster
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    const isRunning = this.isShiftKeyDown();
    return { x: vx, y: vy, isRunning };
  }

  /** @returns {import('../common/direction.js').Direction} */
  getDirectionKeyJustPressed() {
    if (this.#cursorKeys === undefined) {
      return DIRECTION.NONE;
    }

    /** @type {import('../common/direction.js').Direction} */
    let selectedDirection = DIRECTION.NONE;
    if (Phaser.Input.Keyboard.JustDown(this.#cursorKeys.left) || (this.#wasdKeys && Phaser.Input.Keyboard.JustDown(this.#wasdKeys.left))) {
      selectedDirection = DIRECTION.LEFT;
    } else if (Phaser.Input.Keyboard.JustDown(this.#cursorKeys.right) || (this.#wasdKeys && Phaser.Input.Keyboard.JustDown(this.#wasdKeys.right))) {
      selectedDirection = DIRECTION.RIGHT;
    } else if (Phaser.Input.Keyboard.JustDown(this.#cursorKeys.up) || (this.#wasdKeys && Phaser.Input.Keyboard.JustDown(this.#wasdKeys.up))) {
      selectedDirection = DIRECTION.UP;
    } else if (Phaser.Input.Keyboard.JustDown(this.#cursorKeys.down) || (this.#wasdKeys && Phaser.Input.Keyboard.JustDown(this.#wasdKeys.down))) {
      selectedDirection = DIRECTION.DOWN;
    }

    return selectedDirection;
  }

  /** @returns {import('../common/direction.js').Direction} */
  getDirectionKeyPressedDown() {
    if (this.#cursorKeys === undefined) {
      return DIRECTION.NONE;
    }

    /** @type {import('../common/direction.js').Direction} */
    let selectedDirection = DIRECTION.NONE;
    if (this.#cursorKeys.left.isDown || this.#wasdKeys?.left.isDown) {
      selectedDirection = DIRECTION.LEFT;
    } else if (this.#cursorKeys.right.isDown || this.#wasdKeys?.right.isDown) {
      selectedDirection = DIRECTION.RIGHT;
    } else if (this.#cursorKeys.up.isDown || this.#wasdKeys?.up.isDown) {
      selectedDirection = DIRECTION.UP;
    } else if (this.#cursorKeys.down.isDown || this.#wasdKeys?.down.isDown) {
      selectedDirection = DIRECTION.DOWN;
    }

    return selectedDirection;
  }
}
