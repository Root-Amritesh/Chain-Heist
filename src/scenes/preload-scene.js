import {
  ATTACK_ASSET_KEYS,
  BATTLE_ASSET_KEYS,
  BATTLE_BACKGROUND_ASSET_KEYS,
  CHARACTER_ASSET_KEYS,
  EXTERNAL_LINKS_ASSET_KEYS,
  DATA_ASSET_KEYS,
  HEALTH_BAR_ASSET_KEYS,
  INVENTORY_ASSET_KEYS,
  MONSTER_ASSET_KEYS,
  MONSTER_PARTY_ASSET_KEYS,
  TITLE_ASSET_KEYS,
  UI_ASSET_KEYS,
  WORLD_ASSET_KEYS,
  AUDIO_ASSET_KEYS,
  BUILDING_ASSET_KEYS,
  EXP_BAR_ASSET_KEYS,
} from '../assets/asset-keys.js';
import { SCENE_KEYS } from './scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { WebFontFileLoader } from '../assets/web-font-file-loader.js';
import { DataUtils } from '../utils/data-utils.js';
import { dataManager } from '../utils/data-manager.js';
import { SHOW_SOCIAL_LINKS } from '../config.js';
import { BaseScene } from './base-scene.js';
import { setGlobalSoundSettings } from '../utils/audio-utils.js';
import { BITHUNTER_ASSETS } from '../assets/bithunter-asset-keys.js';

export class PreloadScene extends BaseScene {
  constructor() {
    super({
      key: SCENE_KEYS.PRELOAD_SCENE,
    });
  }

  /**
   * @returns {void}
   */
  preload() {
    super.preload();

    const monsterTamerAssetPath = 'assets/images/monster-tamer';
    const kenneysAssetPath = 'assets/images/kenneys-assets';
    const pimenAssetPath = 'assets/images/pimen';
    const axulArtAssetPath = 'assets/images/axulart';
    const pbGamesAssetPath = 'assets/images/parabellum-games';

    // external social links assets
    if (SHOW_SOCIAL_LINKS) {
      this.load.image(
        EXTERNAL_LINKS_ASSET_KEYS.GITHUB_BANNER,
        'assets/images/external-social/forkme_right_red_aa0000.webp'
      );
      this.load.image(
        EXTERNAL_LINKS_ASSET_KEYS.YOUTUBE_BUTTON,
        'assets/images/external-social/WatchonYouTube-white-3xPNG.png'
      );
      this.load.image(EXTERNAL_LINKS_ASSET_KEYS.LEARN_MORE_BACKGROUND, 'assets/images/external-social/blank.png');
      this.load.image(EXTERNAL_LINKS_ASSET_KEYS.YOUTUBE_THUMB_NAIL, 'assets/images/external-social/thumbnail.jpeg');
    }

    // battle backgrounds
    this.load.image(
      BATTLE_BACKGROUND_ASSET_KEYS.FOREST,
      'assets/images/bithunter/maps/neo-city.png'
    );

    // health bar assets
    this.load.image(HEALTH_BAR_ASSET_KEYS.RIGHT_CAP, 'assets/images/bithunter/ui/hp-bar-green.png');
    this.load.image(HEALTH_BAR_ASSET_KEYS.MIDDLE, 'assets/images/bithunter/ui/hp-bar-green.png');
    this.load.image(HEALTH_BAR_ASSET_KEYS.LEFT_CAP, 'assets/images/bithunter/ui/hp-bar-green.png');
    this.load.image(EXP_BAR_ASSET_KEYS.EXP_RIGHT_CAP, 'assets/images/bithunter/ui/hp-bar-pink.png');
    this.load.image(EXP_BAR_ASSET_KEYS.EXP_MIDDLE, 'assets/images/bithunter/ui/hp-bar-pink.png');
    this.load.image(EXP_BAR_ASSET_KEYS.EXP_LEFT_CAP, 'assets/images/bithunter/ui/hp-bar-pink.png');
    this.load.image(HEALTH_BAR_ASSET_KEYS.RIGHT_CAP_SHADOW, 'assets/images/bithunter/ui/hp-bar-pink.png');
    this.load.image(HEALTH_BAR_ASSET_KEYS.MIDDLE_SHADOW, 'assets/images/bithunter/ui/hp-bar-pink.png');
    this.load.image(HEALTH_BAR_ASSET_KEYS.LEFT_CAP_SHADOW, 'assets/images/bithunter/ui/hp-bar-pink.png');

    // ui assets
    this.load.image(UI_ASSET_KEYS.CURSOR, 'assets/images/bithunter/ui/cursor.png');
    this.load.image(UI_ASSET_KEYS.CURSOR_WHITE, 'assets/images/bithunter/ui/cursor.png');
    this.load.image(UI_ASSET_KEYS.MENU_BACKGROUND, 'assets/images/bithunter/ui/panel-network.png');
    this.load.image(
      UI_ASSET_KEYS.MENU_BACKGROUND_PURPLE,
      'assets/images/bithunter/ui/panel-network.png'
    );
    this.load.image(UI_ASSET_KEYS.MENU_BACKGROUND_GREEN, 'assets/images/bithunter/ui/panel-network.png');
    this.load.image(UI_ASSET_KEYS.BLUE_BUTTON, 'assets/images/bithunter/ui/panel-submenu.png');
    this.load.image(UI_ASSET_KEYS.BLUE_BUTTON_SELECTED, 'assets/images/bithunter/ui/panel-submenu.png');

    // load json data
    this.load.json(DATA_ASSET_KEYS.ATTACKS, 'assets/data/attacks.json');
    this.load.json(DATA_ASSET_KEYS.ANIMATIONS, 'assets/data/animations.json');
    this.load.json(DATA_ASSET_KEYS.ITEMS, 'assets/data/items.json');
    this.load.json(DATA_ASSET_KEYS.MONSTERS, 'assets/data/monsters.json');
    this.load.json(DATA_ASSET_KEYS.ENCOUNTERS, 'assets/data/encounters.json');
    this.load.json(DATA_ASSET_KEYS.NPCS, 'assets/data/npcs.json');
    this.load.json(DATA_ASSET_KEYS.EVENTS, 'assets/data/events.json');
    this.load.json(DATA_ASSET_KEYS.SIGNS, 'assets/data/signs.json');

    // load custom fonts
    this.load.addFile(new WebFontFileLoader(this.load, [KENNEY_FUTURE_NARROW_FONT_NAME]));

    // load attack assets
    this.load.spritesheet(ATTACK_ASSET_KEYS.ICE_SHARD, `${pimenAssetPath}/ice-attack/active.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet(ATTACK_ASSET_KEYS.ICE_SHARD_START, `${pimenAssetPath}/ice-attack/start.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet(ATTACK_ASSET_KEYS.SLASH, `${pimenAssetPath}/slash.png`, {
      frameWidth: 48,
      frameHeight: 48,
    });

    // load world assets
    this.load.spritesheet(WORLD_ASSET_KEYS.GRASS, 'assets/images/bithunter/props/card.png', {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.image(WORLD_ASSET_KEYS.MAIN_1_BACKGROUND, 'assets/images/bithunter/maps/neo-city.png');
    this.load.image(WORLD_ASSET_KEYS.MAIN_1_FOREGROUND, 'assets/images/bithunter/maps/neo-city-foreground.png');
    this.load.tilemapTiledJSON(WORLD_ASSET_KEYS.MAIN_1_LEVEL, `assets/data/neo-city.json`);
    this.load.tilemapTiledJSON('NEO_CITY_LEVEL', `assets/data/neo-city.json`);
    this.load.image(WORLD_ASSET_KEYS.WALKMASK, 'assets/images/bithunter/maps/neo-city-walkmask.png');

    // load character images
    this.load.spritesheet(CHARACTER_ASSET_KEYS.PLAYER, 'assets/images/bithunter/characters/cat-1.png', {
      frameWidth: 98,
      frameHeight: 138,
    });
    this.load.spritesheet(CHARACTER_ASSET_KEYS.NPC, 'assets/images/bithunter/characters/npc-01.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // Hacker Ape enemies
    this.load.image('HACKER_APE_1', 'assets/images/bithunter/enemies/ape-1.png');
    this.load.image('HACKER_APE_2', 'assets/images/bithunter/enemies/ape-2.png');
    this.load.image('HACKER_APE_3', 'assets/images/bithunter/enemies/ape-3.png');

    // ui components for title
    this.load.image(TITLE_ASSET_KEYS.BACKGROUND, 'assets/images/bithunter/maps/neo-city.png');
    this.load.image(TITLE_ASSET_KEYS.PANEL, 'assets/images/bithunter/ui/panel-network.png');
    this.load.image(TITLE_ASSET_KEYS.TITLE, 'assets/images/bithunter/ui/logo-bit-hunter.png');

    // ui components for monster party
    this.load.image(
      MONSTER_PARTY_ASSET_KEYS.PARTY_BACKGROUND,
      'assets/images/bithunter/ui/panel-network.png'
    );
    this.load.image(
      MONSTER_PARTY_ASSET_KEYS.MONSTER_DETAILS_BACKGROUND,
      'assets/images/bithunter/ui/panel-network.png'
    );

    // ui components for inventory
    this.load.image(
      INVENTORY_ASSET_KEYS.INVENTORY_BACKGROUND,
      'assets/images/bithunter/ui/panel-inventory.png'
    );
    this.load.image(INVENTORY_ASSET_KEYS.INVENTORY_BAG, 'assets/images/bithunter/items/hw-wallet.png');

    // load audio
    this.load.setPath('assets/audio/xDeviruchi');
    this.load.audio(AUDIO_ASSET_KEYS.MAIN, 'And-the-Journey-Begins.wav');
    this.load.audio(AUDIO_ASSET_KEYS.BATTLE, 'Decisive-Battle.wav');
    this.load.audio(AUDIO_ASSET_KEYS.TITLE, 'Title-Theme.wav');
    this.load.setPath('assets/audio/leohpaz');
    this.load.audio(AUDIO_ASSET_KEYS.CLAW, '03_Claw_03.wav');
    this.load.audio(AUDIO_ASSET_KEYS.GRASS, '03_Step_grass_03.wav');
    this.load.audio(AUDIO_ASSET_KEYS.ICE, '13_Ice_explosion_01.wav');
    this.load.audio(AUDIO_ASSET_KEYS.FLEE, '51_Flee_02.wav');

    // Reset base path before loading Bit-Hunter 2099 assets
    this.load.setPath('');
    BITHUNTER_ASSETS.forEach(({ key, path }) => {
      this.load.image(key, path);
    });
  }

  /**
   * @returns {void}
   */
  create() {
    super.create();

    // Ensure pixel art texture filtering for all Bit-Hunter textures
    BITHUNTER_ASSETS.forEach(({ key }) => {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    // create animations from json file
    this.#createAnimations();

    // attempt to populate data manager with saved data and initialize
    dataManager.loadData();
    // set global audio based on data manager settings
    setGlobalSoundSettings(this);

    this.scene.start(SCENE_KEYS.TITLE_SCENE);
  }

  /**
   * @returns {void}
   */
  #createAnimations() {
    const animations = DataUtils.getAnimations(this);
    animations.forEach((animation) => {
      if (!this.textures.exists(animation.assetKey)) {
        return;
      }
      const frames = animation.frames
        ? this.anims.generateFrameNumbers(animation.assetKey, { frames: animation.frames })
        : this.anims.generateFrameNumbers(animation.assetKey);
      this.anims.create({
        key: animation.key,
        frames: frames,
        frameRate: animation.frameRate,
        repeat: animation.repeat,
        delay: animation.delay,
        yoyo: animation.yoyo,
      });
    });
  }
}
