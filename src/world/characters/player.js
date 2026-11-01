import Phaser from '../../lib/phaser.js';
import { CHARACTER_ASSET_KEYS } from '../../assets/asset-keys.js';
import { DIRECTION } from '../../common/direction.js';
import { Character } from './character.js';
import { dataManager } from '../../utils/data-manager.js';

/**
 * @typedef PlayerConfigProps
 * @type {object}
 * @property {Phaser.Tilemaps.ObjectLayer} [entranceLayer]
 * @property {(entranceName: string, entranceId: string, isBuildingEntrance: boolean) => void} enterEntranceCallback
 */

/**
 * @typedef {Omit<import('./character').CharacterConfig, 'assetKey' | 'idleFrameConfig'> & PlayerConfigProps} PlayerConfig
 */

export class Player extends Character {
  /** @type {Phaser.Tilemaps.ObjectLayer | undefined} */
  #entranceLayer;
  /** @type {(entranceName: string, entranceId: string, isBuildingEntrance: boolean) => void} */
  #enterEntranceCallback;
  /** @type {Phaser.GameObjects.Image} */
  #catVisual;
  /** @type {Phaser.GameObjects.Ellipse} */
  #shadow;

  /**
   * @param {PlayerConfig} config
   */
  constructor(config) {
    super({
      ...config,
      assetKey: CHARACTER_ASSET_KEYS.PLAYER,
      origin: { x: 0.5, y: 1.0 },
      idleFrameConfig: {
        DOWN: 7,
        UP: 1,
        NONE: 7,
        LEFT: 10,
        RIGHT: 4,
      },
    });
    this.#entranceLayer = config.entranceLayer;
    this.#enterEntranceCallback = config.enterEntranceCallback;

    // Hide original humanoid spritesheet
    this._phaserGameObject.setAlpha(0);

    // Chosen cat single-frame unit (crisp ~46px tall, feet at bottom-centre)
    const catAssetKey = dataManager.getPlayerCat();
    this.#catVisual = this._scene.add
      .image(config.position.x, config.position.y, catAssetKey)
      .setOrigin(0.5, 1.0)
      .setScale(1 / 3)
      .setDepth(config.position.y);

    if (this.#catVisual.texture) {
      this.#catVisual.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Soft oval shadow under character: ~28x8 px, black at 35% opacity
    // Placed at depth = feetY - 0.1 so it stays immediately under the player, above background
    this.#shadow = this._scene.add
      .ellipse(config.position.x, config.position.y, 28, 8, 0x000000, 0.35)
      .setDepth(config.position.y - 0.1);

    // Ensure visual and shadow are cleaned up if base object is destroyed
    this._phaserGameObject.on(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.#catVisual && this.#catVisual.scene) {
        this.#catVisual.destroy();
      }
      if (this.#shadow && this.#shadow.scene) {
        this.#shadow.destroy();
      }
    });
  }

  /**
   * @param {import('../../common/direction.js').Direction} direction
   * @param {boolean} [isRunning=false]
   * @param {{ x: number, y: number } | null} [vector=null]
   * @returns {void}
   */
  moveCharacter(direction, isRunning = false, vector = null) {
    super.moveCharacter(direction, isRunning, vector);

    // Flip cat horizontally for left/right motion
    if (this._direction === DIRECTION.LEFT) {
      this.#catVisual.setFlipX(true);
    } else if (this._direction === DIRECTION.RIGHT) {
      this.#catVisual.setFlipX(false);
    }

    // Validate entrance collision if nearby
    if (this.#entranceLayer !== undefined && this.#enterEntranceCallback) {
      const px = this._phaserGameObject.x;
      const py = this._phaserGameObject.y;
      const nearbyEntrance = this.#entranceLayer.objects.find((object) => {
        if (!object.x || !object.y) {
          return false;
        }
        const dist = Phaser.Math.Distance.Between(px, py, object.x, object.y);
        return dist < 32;
      });

      if (nearbyEntrance) {
        const entranceName = nearbyEntrance.properties?.find((p) => p.name === 'connects_to')?.value;
        const entranceId = nearbyEntrance.properties?.find((p) => p.name === 'entrance_id')?.value;
        const isBuildingEntrance =
          nearbyEntrance.properties?.find((p) => p.name === 'is_building')?.value || false;
        if (entranceName && entranceId) {
          this.#enterEntranceCallback(entranceName, entranceId, isBuildingEntrance);
        }
      }
    }
  }

  /** @type {Phaser.GameObjects.Image} */
  get catVisual() {
    return this.#catVisual;
  }

  /**
   * @param {DOMHighResTimeStamp} time
   * @param {number} [delta=16.66]
   * @returns {void}
   */
  update(time, delta = 16.66) {
    super.update(time, delta);

    // 1px bob while moving, stationary when idle
    const bobOffset = this._isMoving ? (Math.floor(time / 140) % 2 === 0 ? -1 : 0) : 0;
    const px = this._phaserGameObject.x;
    const py = this._phaserGameObject.y;

    this.#catVisual.setPosition(px, py + bobOffset);
    this.#shadow.setPosition(px, py);

    // Dynamic depth sorting: character and shadow depth match feet Y coordinate
    this.#catVisual.setDepth(py);
    this.#shadow.setDepth(py - 0.1);

    // Maintain flip state
    if (this._direction === DIRECTION.LEFT) {
      this.#catVisual.setFlipX(true);
    } else if (this._direction === DIRECTION.RIGHT) {
      this.#catVisual.setFlipX(false);
    }
  }
}
