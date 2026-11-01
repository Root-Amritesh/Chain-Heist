import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { dataManager } from '../utils/data-manager.js';
import { animateText } from '../utils/text-utils.js';

export class IntroScene extends BaseScene {
  /** @type {string[]} */
  #dialogPages = [];
  /** @type {number} */
  #currentPageIndex = 0;
  /** @type {Phaser.GameObjects.Text} */
  #dialogBodyText;
  /** @type {Phaser.GameObjects.Text} */
  #promptText;
  /** @type {boolean} */
  #isTyping = false;
  /** @type {boolean} */
  #isTransitioning = false;

  constructor() {
    super({
      key: SCENE_KEYS.INTRO_SCENE,
    });
  }

  create() {
    super.create();
    this.#currentPageIndex = 0;
    this.#isTyping = false;
    this.#isTransitioning = false;

    this.cameras.main.setBackgroundColor('#070410');
    this.cameras.main.fadeIn(500);

    const playerName = dataManager.getPlayerName();

    this.#dialogPages = [
      'PROF. LEDGER: Neo-City, 2099. Everything in this metropolis runs on the chain—our financial reserves, smart infrastructure, and district security protocols.',
      'PROF. LEDGER: Rogue hacker apes are attacking our network! They are executing flash exploits to compromise municipal consensus nodes.',
      `PROF. LEDGER: Your mission, Hunter ${playerName}: secure 4 districts before the clock hits zero. You have 3 lives.`,
      'PROF. LEDGER: Your unit is synced to the blockchain ledger. Infiltrate the perimeter and defend the city!',
    ];

    // Cyberpunk grid backdrop
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1a1236, 0.5);
    for (let x = 0; x < this.scale.width; x += 32) {
      gridGraphics.lineBetween(x, 0, x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += 32) {
      gridGraphics.lineBetween(0, y, this.scale.width, y);
    }

    // Top Transmission Banner
    this.add.rectangle(this.scale.width / 2, 40, 880, 52, 0x0f0b24, 0.95)
      .setStrokeStyle(2, 0x3FF0FF, 0.8);

    this.add.text(this.scale.width / 2, 30, 'ENCRYPTED NEURAL TRANSMISSION // NODE 01 // FREQ: 2099.44 MHZ', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, 50, 'STATUS: SECURE PEER-TO-PEER DATASTREAM', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#00FF66',
    }).setOrigin(0.5);

    // PROF. LEDGER Portrait Frame
    const portraitX = 190;
    const portraitY = 220;
    const portraitFrame = this.add.rectangle(portraitX, portraitY, 210, 240, 0x120d2a, 0.9)
      .setStrokeStyle(3, 0x3FF0FF, 0.9);

    // Scanlines over portrait
    const scanlines = this.add.graphics();
    scanlines.lineStyle(1, 0x3FF0FF, 0.15);
    for (let sy = portraitY - 110; sy < portraitY + 110; sy += 4) {
      scanlines.lineBetween(portraitX - 95, sy, portraitX + 95, sy);
    }

    // Prof Ledger NPC sprite
    const npcSprite = this.add.image(portraitX, portraitY - 15, 'npc-01')
      .setScale(1.25)
      .setOrigin(0.5);

    // Hologram flicker
    this.tweens.add({
      targets: npcSprite,
      alpha: { from: 0.88, to: 1 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
    });

    // Badge below portrait
    this.add.rectangle(portraitX, portraitY + 90, 180, 32, 0x0c071d, 0.95)
      .setStrokeStyle(1, 0xFFD700);

    this.add.text(portraitX, portraitY + 83, 'PROF. LEDGER', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(portraitX, portraitY + 98, 'CHIEF CONSENSUS ARCHITECT', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '10px',
      color: '#A09CB8',
    }).setOrigin(0.5);

    // Target Mission Briefing Header
    const briefingX = 610;
    const briefingY = 160;
    this.add.rectangle(briefingX, briefingY, 590, 120, 0x0f0b24, 0.9)
      .setStrokeStyle(1, 0xFFD700, 0.7);

    this.add.text(briefingX - 270, briefingY - 45, 'MISSION DIRECTIVE: DEFEND NEO-CITY', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#FFD700',
      fontStyle: 'bold',
    });

    this.add.text(briefingX - 270, briefingY - 18, `• OPERATIVE: ${playerName}\n• THREAT LEVEL: CRITICAL (HACKER APE INVASION)\n• TARGETS: SECURE 3 DISTRICTS BEFORE TIMEOUT\n• REMAINING LIVES: 3`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#D8D4EC',
      lineSpacing: 4,
    });

    // Main Dialog Box
    const dialogBoxY = 415;
    this.add.rectangle(this.scale.width / 2, dialogBoxY, 880, 150, 0x0c071e, 0.95)
      .setStrokeStyle(3, 0x3FF0FF, 1);

    // Name tab above dialog box
    this.add.rectangle(140, dialogBoxY - 75, 140, 26, 0x070410, 1)
      .setStrokeStyle(2, 0x3FF0FF);
    this.add.text(140, dialogBoxY - 75, 'PROF. LEDGER', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.#dialogBodyText = this.add.text(95, dialogBoxY - 50, '', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '22px',
      color: '#FFFFFF',
      lineSpacing: 8,
      wordWrap: { width: 830 },
    });

    this.#promptText = this.add.text(this.scale.width / 2 + 370, dialogBoxY + 54, 'SPACE TO CONTINUE ▶', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    this.tweens.add({
      targets: this.#promptText,
      alpha: { from: 0.3, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.#renderCurrentPage();

    this.input.on('pointerdown', () => {
      if (this.#isTransitioning) return;
      if (this.#isTyping) {
        this.#dialogBodyText.setText(this.#dialogPages[this.#currentPageIndex]);
        this.#isTyping = false;
        return;
      }
      this.#currentPageIndex += 1;
      if (this.#currentPageIndex < this.#dialogPages.length) {
        this.#renderCurrentPage();
      } else {
        this.#finishIntro();
      }
    });
  }

  update() {
    super.update();
    if (this.#isTransitioning || this._controls.isInputLocked) {
      return;
    }

    if (this._controls.wasSpaceKeyPressed() || this._controls.wasEnterKeyPressed()) {
      if (this.#isTyping) {
        // Complete current text immediately
        this.#dialogBodyText.setText(this.#dialogPages[this.#currentPageIndex]);
        this.#isTyping = false;
        return;
      }

      this.#currentPageIndex += 1;
      if (this.#currentPageIndex < this.#dialogPages.length) {
        this.#renderCurrentPage();

    this.input.on('pointerdown', () => {
      if (this.#isTransitioning) return;
      if (this.#isTyping) {
        this.#dialogBodyText.setText(this.#dialogPages[this.#currentPageIndex]);
        this.#isTyping = false;
        return;
      }
      this.#currentPageIndex += 1;
      if (this.#currentPageIndex < this.#dialogPages.length) {
        this.#renderCurrentPage();
      } else {
        this.#finishIntro();
      }
    });
      } else {
        this.#finishIntro();
      }
    }
  }

  #renderCurrentPage() {
    const textToType = this.#dialogPages[this.#currentPageIndex];
    this.#dialogBodyText.setText('');
    this.#isTyping = true;

    animateText(this, this.#dialogBodyText, textToType, {
      delay: 20,
      callback: () => {
        this.#isTyping = false;
      },
    });

    if (this.#currentPageIndex === this.#dialogPages.length - 1) {
      this.#promptText.setText('PRESS SPACE TO ENTER NEO-CITY ▶');
    }
  }

  #finishIntro() {
    this.#isTransitioning = true;
    this._controls.lockInput = true;

    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.WORLD_SCENE);
    });
  }
}

