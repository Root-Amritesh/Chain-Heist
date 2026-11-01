import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BITHUNTER_ASSETS } from '../assets/bithunter-asset-keys.js';

export class DebugAssetsScene extends Phaser.Scene {
  /** @type {number} */
  #scrollOffsetY = 0;
  /** @type {Phaser.GameObjects.Container} */
  #contentContainer;
  /** @type {number} */
  #maxScroll = 0;

  constructor() {
    super({
      key: SCENE_KEYS.DEBUG_ASSETS_SCENE,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0614');

    // Header
    const headerBg = this.add.rectangle(0, 0, this.scale.width, 40, 0x1a1230, 0.95).setOrigin(0).setDepth(10);
    this.add.text(10, 8, 'BIT-HUNTER 2099 - TEXTURE GALLERY (UP/DOWN or MOUSE WHEEL, ESC to Title)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setDepth(11);

    this.#contentContainer = this.add.container(0, 50);

    const cols = 5;
    const colWidth = Math.floor(this.scale.width / cols);
    const rowHeight = 110;

    let col = 0;
    let row = 0;

    BITHUNTER_ASSETS.forEach(({ key }) => {
      const x = col * colWidth + colWidth / 2;
      const y = row * rowHeight + 40;

      // Card frame
      const card = this.add.rectangle(x, y + 10, colWidth - 8, rowHeight - 8, 0x1f143d, 0.8)
        .setStrokeStyle(1, 0x3d276b);
      this.#contentContainer.add(card);

      // Sprite image (scale to fit card preview if big)
      if (this.textures.exists(key)) {
        const sprite = this.add.image(x, y - 5, key);
        const maxW = colWidth - 24;
        const maxH = 50;
        const scale = Math.min(1, maxW / sprite.width, maxH / sprite.height);
        sprite.setScale(scale);
        this.#contentContainer.add(sprite);
      }

      // Key label
      const label = this.add.text(x, y + 36, key, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#FF3FD0',
        align: 'center',
        wordWrap: { width: colWidth - 12 },
      }).setOrigin(0.5);
      this.#contentContainer.add(label);

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    });

    const totalHeight = (row + 1) * rowHeight + 80;
    this.#maxScroll = Math.max(0, totalHeight - this.scale.height);

    // Controls
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.#scroll(deltaY * 0.5);
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.TITLE_SCENE);
    });
    this.input.keyboard.on('keydown-SPACE', () => {
      this.scene.start(SCENE_KEYS.TITLE_SCENE);
    });
  }

  update() {
    const cursors = this.input.keyboard.createCursorKeys();
    if (cursors.down.isDown) {
      this.#scroll(8);
    } else if (cursors.up.isDown) {
      this.#scroll(-8);
    }
  }

  #scroll(delta) {
    this.#scrollOffsetY = Phaser.Math.Clamp(this.#scrollOffsetY + delta, 0, this.#maxScroll);
    this.#contentContainer.y = 50 - this.#scrollOffsetY;
  }
}

