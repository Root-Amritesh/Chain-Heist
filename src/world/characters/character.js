import Phaser from '../../lib/phaser.js';
import { DIRECTION } from '../../common/direction.js';
import { exhaustiveGuard } from '../../utils/guard.js';
import { resolveMovement } from '../walkmask.js';
import { PLAYER_SPEED, PLAYER_RUN_SPEED, FEET_BOX_WIDTH, FEET_BOX_HEIGHT } from '../../config.js';

/**
 * @typedef CharacterIdleFrameConfig
 * @type {object}
 * @property {number} LEFT
 * @property {number} RIGHT
 * @property {number} UP
 * @property {number} DOWN
 * @property {number} NONE
 */

/**
 * @typedef CharacterConfig
 * @type {object}
 * @property {Phaser.Scene} scene
 * @property {string} assetKey
 * @property {import('../../types/typedef.js').Coordinate} [origin={ x: 0.5, y: 1.0 }]
 * @property {import('../../types/typedef.js').Coordinate} position
 * @property {import('../../common/direction.js').Direction} direction
 * @property {() => void} [spriteGridMovementFinishedCallback]
 * @property {CharacterIdleFrameConfig} idleFrameConfig
 * @property {Character[]} [otherCharactersToCheckForCollisionsWith=[]]
 * @property {() => void} [spriteChangedDirectionCallback]
 * @property {{position: import('../../types/typedef.js').Coordinate}[]} [objectsToCheckForCollisionsWith]
 * @property {(position: import('../../types/typedef.js').Coordinate) => void} [spriteGridMovementStartedCallback]
 */

export class Character {
  /** @type {Phaser.Scene} */
  _scene;
  /** @type {Phaser.GameObjects.Sprite} */
  _phaserGameObject;
  /** @protected @type {import('../../common/direction.js').Direction} */
  _direction;
  /** @protected @type {import('../../common/direction.js').Direction} */
  _requestedDirection;
  /** @protected @type {{ x: number, y: number } | null} */
  _requestedVector;
  /** @protected @type {boolean} */
  _isMoving;
  /** @protected @type {import('../../types/typedef.js').Coordinate} */
  _targetPosition;
  /** @protected @type {import('../../types/typedef.js').Coordinate} */
  _previousTargetPosition;
  /** @protected @type {() => void | undefined} */
  _spriteGridMovementFinishedCallback;
  /** @protected @type {CharacterIdleFrameConfig} */
  _idleFrameConfig;
  /** @protected @type {import('../../types/typedef.js').Coordinate} */
  _origin;
  /** @protected @type {Character[]} */
  _otherCharactersToCheckForCollisionsWith;
  /** @protected @type {() => void | undefined} */
  _spriteChangedDirectionCallback;
  /** @protected @type {{position: import('../../types/typedef.js').Coordinate}[]} */
  _objectsToCheckForCollisionsWith;
  /** @protected @type {(position: import('../../types/typedef.js').Coordinate) => void | undefined} */
  _spriteGridMovementStartedCallback;
  /** @protected @type {boolean} */
  _isRunning;
  /** @protected @type {number} */
  _stepTimer;

  /**
   * @param {CharacterConfig} config
   */
  constructor(config) {
    if (this.constructor === Character) {
      throw new Error('Character is an abstract class and cannot be instantiated.');
    }

    this._scene = config.scene;
    this._direction = config.direction;
    this._requestedDirection = DIRECTION.NONE;
    this._requestedVector = null;
    this._isMoving = false;
    this._isRunning = false;
    this._targetPosition = { ...config.position };
    this._previousTargetPosition = { ...config.position };
    this._idleFrameConfig = config.idleFrameConfig;
    this._origin = config.origin ? { ...config.origin } : { x: 0.5, y: 1.0 };
    this._otherCharactersToCheckForCollisionsWith = config.otherCharactersToCheckForCollisionsWith || [];
    this._phaserGameObject = this._scene.add
      .sprite(config.position.x, config.position.y, config.assetKey, this._getIdleFrame())
      .setOrigin(this._origin.x, this._origin.y)
      .setDepth(config.position.y);
    this._spriteGridMovementFinishedCallback = config.spriteGridMovementFinishedCallback;
    this._spriteChangedDirectionCallback = config.spriteChangedDirectionCallback;
    this._objectsToCheckForCollisionsWith = config.objectsToCheckForCollisionsWith || [];
    this._spriteGridMovementStartedCallback = config.spriteGridMovementStartedCallback;
    this._stepTimer = 0;
  }

  /** @type {Phaser.GameObjects.Sprite} */
  get sprite() {
    return this._phaserGameObject;
  }

  /** @type {boolean} */
  get isMoving() {
    return this._isMoving;
  }

  /** @type {import('../../common/direction.js').Direction} */
  get direction() {
    return this._direction;
  }

  /**
   * @param {import('../../common/direction.js').Direction} direction
   * @param {boolean} [isRunning=false]
   * @param {{ x: number, y: number } | null} [vector=null]
   * @returns {void}
   */
  moveCharacter(direction, isRunning = false, vector = null) {
    this._requestedDirection = direction;
    this._isRunning = isRunning;
    this._requestedVector = vector;

    if (direction !== DIRECTION.NONE && this._direction !== direction) {
      this._direction = direction;
      if (this._spriteChangedDirectionCallback !== undefined) {
        this._spriteChangedDirectionCallback();
      }
    }
  }

  /**
   * @param {Character} character
   * @returns {void}
   */
  addCharacterToCheckForCollisionsWith(character) {
    this._otherCharactersToCheckForCollisionsWith.push(character);
  }

  /**
   * @param {DOMHighResTimeStamp} time
   * @param {number} [delta=16.66]
   * @returns {void}
   */
  update(time, delta = 16.66) {
    const dt = Math.min((delta || 16.66) / 1000, 0.05);

    const hasVector = this._requestedVector && (this._requestedVector.x !== 0 || this._requestedVector.y !== 0);
    const hasDirection = this._requestedDirection !== DIRECTION.NONE;

    if (hasVector || hasDirection) {
      const speed = this._isRunning ? PLAYER_RUN_SPEED : PLAYER_SPEED;
      let vx = 0;
      let vy = 0;

      if (hasVector) {
        vx = this._requestedVector.x * speed;
        vy = this._requestedVector.y * speed;
      } else {
        switch (this._requestedDirection) {
          case DIRECTION.UP:
            vy = -speed;
            break;
          case DIRECTION.DOWN:
            vy = speed;
            break;
          case DIRECTION.LEFT:
            vx = -speed;
            break;
          case DIRECTION.RIGHT:
            vx = speed;
            break;
          default:
            break;
        }
      }

      const dx = vx * dt;
      const dy = vy * dt;
      const oldX = this._phaserGameObject.x;
      const oldY = this._phaserGameObject.y;

      // Sub-step movement and resolve X & Y independently against walkmask
      const resolved = resolveMovement(oldX, oldY, dx, dy, FEET_BOX_WIDTH / 2, FEET_BOX_HEIGHT / 2);

      // Check collision with other characters (feet distance circle)
      let finalX = resolved.x;
      let finalY = resolved.y;

      for (const other of this._otherCharactersToCheckForCollisionsWith) {
        if (!other || other === this) continue;
        const otherPos = other.sprite ? { x: other.sprite.x, y: other.sprite.y } : other._targetPosition;
        if (!otherPos) continue;
        const dist = Phaser.Math.Distance.Between(finalX, finalY, otherPos.x, otherPos.y);
        if (dist < 18) {
          // Push back to prevent overlapping other characters
          finalX = oldX;
          finalY = oldY;
          break;
        }
      }

      this._phaserGameObject.setPosition(finalX, finalY);
      this._phaserGameObject.setDepth(finalY);
      this._targetPosition.x = finalX;
      this._targetPosition.y = finalY;

      const moved = (finalX !== oldX || finalY !== oldY);
      this._isMoving = moved;

      if (moved) {
        this._stepTimer += delta;
        // Periodically invoke movement callback for camera bounds, guide trail, coins, etc.
        if (this._stepTimer > 80) {
          this._stepTimer = 0;
          this._previousTargetPosition = { x: finalX, y: finalY };
          if (this._spriteGridMovementFinishedCallback) {
            this._spriteGridMovementFinishedCallback();
          }
        }
      } else {
        this._isMoving = false;
      }

      // Reset requested inputs for next frame; will be populated again if key remains pressed
      this._requestedDirection = DIRECTION.NONE;
      this._requestedVector = null;
    } else {
      this._isMoving = false;
      // Stop animation and show idle frame
      const idleFrame = this._getIdleFrame();
      if (idleFrame !== undefined && this._phaserGameObject.anims) {
        this._phaserGameObject.anims.stop();
        if (this._phaserGameObject.texture && (/** @type {any} */ (this._phaserGameObject.texture)).has(idleFrame)) {
          this._phaserGameObject.setFrame(idleFrame);
        }
      }
    }
  }

  /**
   * @protected
   * @returns {number}
   */
  _getIdleFrame() {
    const frameName = this._idleFrameConfig[this._direction];
    if (this._phaserGameObject?.texture && !(/** @type {any} */ (this._phaserGameObject.texture)).has(frameName)) {
      return 0;
    }
    return frameName ?? 0;
  }
}
