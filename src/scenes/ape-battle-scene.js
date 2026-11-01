import Phaser from '../lib/phaser.js';
import { BaseScene } from './base-scene.js';
import { SCENE_KEYS } from './scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { dataManager } from '../utils/data-manager.js';
import { runState } from '../state/run-state.js';
import { ScoreManager } from '../systems/score-manager.js';
import { MAX_DISTRICTS } from '../config.js';

/**
 * @typedef ApeBattleData
 * @type {object}
 * @property {string} [mode]
 * @property {number} [portalId]
 * @property {string} [game]
 * @property {string} [districtName]
 * @property {string} [apeAsset]
 * @property {string} [apeName]
 */

export class ApeBattleScene extends BaseScene {
  /** @type {ApeBattleData} */
  #data = {};
  /** @type {string} */
  #mode = 'intro'; // 'intro' | 'win' | 'lose'
  /** @type {Phaser.GameObjects.Image} */
  #apeImage;
  /** @type {Phaser.GameObjects.Image} */
  #playerImage;
  /** @type {Phaser.GameObjects.Text} */
  #dialogText;
  /** @type {Phaser.GameObjects.Text} */
  #continuePromptText;
  /** @type {string[]} */
  #queuedMessages = [];
  /** @type {number} */
  #currentMessageIndex = 0;
  /** @type {boolean} */
  #isMessageActive = false;
  /** @type {Function | null} */
  #onMessagesFinishedCallback = null;

  constructor() {
    super({ key: SCENE_KEYS.APE_BATTLE_SCENE });
  }

  init(data) {
    super.init(data);
    this.#data = data || {};
    this.#mode = this.#data.mode || 'intro';
    this.#queuedMessages = [];
    this.#currentMessageIndex = 0;
    this.#isMessageActive = false;
    this.#onMessagesFinishedCallback = null;
  }

  create() {
    super.create();
    this.cameras.main.setBackgroundColor('#070410');
    this.cameras.main.fadeIn(400);

    const width = this.scale.width;
    const height = this.scale.height;

    // 1. Grid battle floor and backdrop
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1b1338, 0.5);
    for (let x = 0; x < width; x += 32) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 32) {
      grid.lineBetween(0, y, width, y);
    }

    // Battle arena platform rings
    const arenaPlatform = this.add.graphics();
    arenaPlatform.fillStyle(0x0e0926, 0.85);
    arenaPlatform.lineStyle(2, 0x3FF0FF, 0.7);
    arenaPlatform.fillEllipse(width * 0.28, height * 0.58, 260, 90);
    arenaPlatform.strokeEllipse(width * 0.28, height * 0.58, 260, 90);

    arenaPlatform.fillStyle(0x0e0926, 0.85);
    arenaPlatform.lineStyle(2, 0xFF3366, 0.7);
    arenaPlatform.fillEllipse(width * 0.72, height * 0.44, 260, 90);
    arenaPlatform.strokeEllipse(width * 0.72, height * 0.44, 260, 90);

    // 2. Player Cat Sprite (Left)
    const catChoice = dataManager.getPlayerCat() || runState.hunter || 'cat-1';
    const catTextureKey = `assets/images/bithunter/characters/${catChoice}.png`;
    const safeCatKey = this.textures.exists(catTextureKey) ? catTextureKey : 'PLAYER';

    this.#playerImage = this.add.image(width * 0.28, height * 0.49, safeCatKey)
      .setOrigin(0.5, 0.8)
      .setScale(1.2);

    this.tweens.add({
      targets: this.#playerImage,
      y: '-=4',
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 3. Hacker Ape Sprite (Right)
    const apeTexture = this.#data.apeAsset || 'HACKER_APE_1';
    const apeStartX = this.#mode === 'intro' ? width + 150 : width * 0.72;

    this.#apeImage = this.add.image(apeStartX, height * 0.35, apeTexture)
      .setOrigin(0.5, 0.8)
      .setScale(1.15);

    if (this.#mode === 'intro') {
      this.tweens.add({
        targets: this.#apeImage,
        x: width * 0.72,
        duration: 700,
        ease: 'Cubic.easeOut',
      });
    }

    // 4. Battle Header Bar
    const districtTitle = this.#data.districtName || 'NEO-CITY DISTRICT NODE';
    this.add.rectangle(width / 2, 38, width - 40, 44, 0x090518, 0.9)
      .setStrokeStyle(2, 0x3FF0FF, 0.8);

    this.add.text(width / 2, 38, `// BATTLE PROTOCOL // ${districtTitle} //`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '17px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 5. Classic Bottom Battle Dialog Panel
    const dialogBoxY = height - 75;
    const dialogW = width - 40;
    const dialogH = 110;

    this.add.rectangle(width / 2, dialogBoxY, dialogW, dialogH, 0x0a061b, 0.96)
      .setStrokeStyle(2, 0x3FF0FF, 0.95);

    this.add.rectangle(width / 2, dialogBoxY + dialogH / 2 - 2, dialogW - 4, 2, 0x3FF0FF, 0.4);

    this.#dialogText = this.add.text(38, dialogBoxY - 35, '', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '22px',
      color: '#FFFFFF',
      wordWrap: { width: dialogW - 80 },
    });

    this.#continuePromptText = this.add.text(width - 45, dialogBoxY + 30, '▶ [SPACE/ENTER]', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#3FF0FF',
    }).setOrigin(1, 0.5);

    this.tweens.add({
      targets: this.#continuePromptText,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Handle flow based on mode
    this.#setupFlowForMode();

    // Key handlers
    this.input.keyboard?.on('keydown-SPACE', () => this.#handleAdvance());
    this.input.keyboard?.on('keydown-ENTER', () => this.#handleAdvance());
    this.input.on('pointerdown', () => this.#handleAdvance());
  }

  #setupFlowForMode() {
    const playerName = runState.name || 'OPERATIVE';
    const districtName = this.#data.districtName || 'DISTRICT';

    if (this.#mode === 'intro') {
      this.#displayMessages([
        'HACKER APE wants to battle!',
      ], () => {
        // Transition into mini-game
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          const gameSceneKey = this.#getMiniGameSceneKey(this.#data.game);
          this.scene.start(gameSceneKey, this.#data);
        });
      });
    } else if (this.#mode === 'win') {
      // Hacker ape defeat animation (red flash & slide down)
      this.tweens.add({
        targets: this.#apeImage,
        tint: 0xFF3366,
        y: '+=20',
        alpha: 0.5,
        duration: 400,
        yoyo: true,
        repeat: 2,
      });

      this.#displayMessages([
        `HACKER APE was defeated! ${playerName} got 600 BIT!`,
        `${playerName} received the ${districtName} BADGE!`,
      ], () => {
        // Report game result idempotently via ScoreManager (adds 600 + 1000 district bonus and marks portal cleared)
        ScoreManager.reportGameResult(this.#data.game || 'battle', {
          score: 600,
          completed: true,
          portalId: this.#data.portalId,
        });

        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          if (runState.cleared.length >= MAX_DISTRICTS) {
            this.scene.start(SCENE_KEYS.RESULTS_SCENE);
          } else {
            this.scene.start(SCENE_KEYS.WORLD_SCENE, {
              defeatedPortalId: this.#data.portalId,
            });
          }
        });
      });
    } else if (this.#mode === 'lose') {
      // Player cat defeated animation (tint & recoil)
      this.tweens.add({
        targets: this.#playerImage,
        tint: 0xFF3366,
        alpha: 0.4,
        x: '-=30',
        duration: 350,
      });

      this.#displayMessages([
        `${playerName} lost a life…`,
      ], () => {
        ScoreManager.reportGameResult(this.#data.game || 'battle', {
          score: 0,
          completed: false,
          portalId: this.#data.portalId,
        });
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          if (runState.lives <= 0) {
            this.scene.start(SCENE_KEYS.RESULTS_SCENE);
          } else {
            this.scene.start(SCENE_KEYS.WORLD_SCENE);
          }
        });
      });
    }
  }

  #getMiniGameSceneKey(gameProp) {
    if (gameProp === 'blockFlyer') return SCENE_KEYS.BLOCK_FLYER_SCENE;
    if (gameProp === 'vaultRun') return SCENE_KEYS.VAULT_RUN_SCENE;
    if (gameProp === 'chainSnake') return SCENE_KEYS.CHAIN_SNAKE_SCENE;
    return SCENE_KEYS.BLOCK_FLYER_SCENE;
  }

  #displayMessages(messages, onFinished) {
    this.#queuedMessages = messages;
    this.#currentMessageIndex = 0;
    this.#onMessagesFinishedCallback = onFinished;
    this.#showNextMessage();
  }

  #showNextMessage() {
    if (this.#currentMessageIndex >= this.#queuedMessages.length) {
      this.#isMessageActive = false;
      if (this.#onMessagesFinishedCallback) {
        this.#onMessagesFinishedCallback();
      }
      return;
    }

    this.#isMessageActive = true;
    const msg = this.#queuedMessages[this.#currentMessageIndex];
    this.#dialogText.setText(msg);
    this.#currentMessageIndex += 1;
  }

  #handleAdvance() {
    if (!this.#isMessageActive) return;
    this.#showNextMessage();
  }
}

