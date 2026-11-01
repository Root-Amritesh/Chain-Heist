import Phaser from '../lib/phaser.js';
import { AUDIO_ASSET_KEYS, WORLD_ASSET_KEYS } from '../assets/asset-keys.js';
import { SCENE_KEYS } from './scene-keys.js';
import { Player } from '../world/characters/player.js';
import { DIRECTION } from '../common/direction.js';
import { ENABLE_ZONE_DEBUGGING, TILED_COLLISION_LAYER_ALPHA, TILE_SIZE, FEET_BOX_WIDTH, FEET_BOX_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, MAP_WIDTH, MAP_HEIGHT, SPEED, PLAYER_SPEED, PLAYER_RUN_SPEED, CAT_DISPLAY_HEIGHT, NPC_DISPLAY_HEIGHT, APE_DISPLAY_HEIGHT, NPC_INTERACTION_RADIUS, DEFAULT_PLAYER_SPAWN, COIN_VALUE, PARTICIPATION_BONUS, MAX_MINIGAME_SCORE, MAX_DISTRICTS } from '../config.js';
import { ScoreManager } from '../systems/score-manager.js';
import { TimeManager, SESSION_END_REASONS } from '../systems/time-manager.js';
import { initWalkmask, isWalkable, getWalkmaskData, paintWalkmask, exportWalkmaskPNG, findNearestReachable, getReachableCount } from '../world/walkmask.js';
import { DATA_MANAGER_STORE_KEYS, dataManager } from '../utils/data-manager.js';
import {
  getTargetDirectionFromGameObjectPosition,
  getTargetPathToGameObject,
  getTargetPositionFromGameObjectPositionAndDirection,
} from '../utils/grid-utils.js';
import { CANNOT_READ_SIGN_TEXT, SAMPLE_TEXT } from '../utils/text-utils.js';
import { NPC, NPC_MOVEMENT_PATTERN } from '../world/characters/npc.js';
import { WorldMenu } from '../world/world-menu.js';
import { BaseScene } from './base-scene.js';
import { DataUtils } from '../utils/data-utils.js';
import { playBackgroundMusic, playSoundFx } from '../utils/audio-utils.js';
import { weightedRandom } from '../utils/random.js';
import { Item } from '../world/item.js';
import { BATTLE_FLAG, ENCOUNTER_TILE_TYPE, GAME_EVENT_TYPE, ITEM_CATEGORY, NPC_EVENT_TYPE } from '../types/typedef.js';
import { exhaustiveGuard } from '../utils/guard.js';
import { sleep } from '../utils/time-utils.js';
import { CutsceneScene } from './cutscene-scene.js';
import { DialogScene } from './dialog-scene.js';
import * as TiledUtils from '../utils/tiled-utils.js';
import * as CameraUtils from '../utils/camera-utils.js';
import {
  CUSTOM_TILED_TYPES,
  OBJECT_LAYER_NAMES,
  TILED_AREA_METADATA_PROPERTY,
  TILED_ENCOUNTER_PROPERTY,
  TILED_EVENT_PROPERTY,
  TILED_ITEM_PROPERTY,
  TILED_NPC_PROPERTY,
  TILED_SIGN_PROPERTY,
} from '../assets/tiled-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { runState, isReduceMotionActive } from '../state/run-state.js';

/**
 * @typedef WorldSceneData
 * @type {object}
 * @property {boolean} [isPlayerKnockedOut]
 * @property {string} [area]
 * @property {boolean} [isInterior]
 */

export class WorldScene extends BaseScene {
  /** @type {Player} */
  #player;
  /** @type {Phaser.Tilemaps.TilemapLayer[]} */
  #encounterLayers;
  /** @type {boolean} */
  #wildMonsterEncountered;
  /** @type {Phaser.Tilemaps.ObjectLayer | undefined} */
  #signLayer;
  /** @type {DialogScene} */
  #dialogUi;
  /** @type {NPC[]} */
  #npcs;
  /** @type {NPC | undefined} */
  #npcPlayerIsInteractingWith;
  /** @type {WorldMenu} */
  #menu;
  /** @type {WorldSceneData} */
  #sceneData;
  /** @type {Item[]} */
  #items;
  /** @type {Phaser.Tilemaps.ObjectLayer | undefined} */
  #entranceLayer;
  /** @type {number} */
  #lastNpcEventHandledIndex;
  /** @type {boolean} */
  #isProcessingNpcEvent;
  /** @type {{[key: string]: Phaser.GameObjects.Zone}} */
  #eventZones;
  /** @type {{[key: string]: Phaser.GameObjects.Rectangle}} */
  #debugEventZoneObjects;
  /** @type {Phaser.Geom.Rectangle} */
  #rectangleForOverlapCheck1;
  /** @type {Phaser.Geom.Rectangle} */
  #rectangleForOverlapCheck2;
  /** @type {Phaser.Geom.Rectangle} */
  #rectangleOverlapResult;
  /** @type {Phaser.GameObjects.Graphics} */
  #gfx;
  /** @type {number | undefined} */
  #currentCutSceneId;
  /** @type {boolean} */
  #isProcessingCutSceneEvent;
  /** @type {number} */
  #lastCutSceneEventHandledIndex;
  /** @type {Phaser.GameObjects.Group} */
  #specialEncounterTileImageGameObjectGroup;
  /** @type {Phaser.Tilemaps.TilemapLayer | undefined} */
  #encounterZonePlayerIsEntering;
  /** @type {import('../types/typedef.js').CameraRegion[]} */
  #cameraRegions;
  /** @type {{ [key: string]: Phaser.Tilemaps.Tilemap}} */
  #tiledLevelMaps;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #hudContainer;
  /** @type {Phaser.GameObjects.Text[]} */
  #hudHeartTexts = [];
  /** @type {Phaser.GameObjects.Text} */
  #hudScoreText;
  /** @type {Phaser.GameObjects.Text[]} */
  #hudPortalTexts = [];
  /** @type {Phaser.GameObjects.Text} */
  #hudTimerText;
  /** @type {boolean} */
  #isGamePaused = false;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #pauseMenuContainer;
  /** @type {Phaser.GameObjects.Text[]} */
  #pauseOptionTexts = [];
  /** @type {number} */
  #selectedPauseOption = 0;
  /** @type {any[]} */
  #portals = [];
  /** @type {any[]} */
  #hackerApes = [];
  /** @type {boolean} */
  #isEngagingPortal = false;
  /** @type {any[]} */
  #coins = [];
  /** @type {any[]} */
  #tokens = [];
  /** @type {Set<number>} */
  #collectedTokenIds = new Set();
  /** @type {Phaser.GameObjects.Text} */
  #hudTokensText;
  /** @type {boolean} */
  #isGuideTrailEnabled = true;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #guideTrailContainer;
  /** @type {number} */
  #lastGuideTrailCalcTime = 0;
  /** @type {number} */
  #lastCatAfterimageTime = 0;
  /** @type {number} */
  #lastCatParticleTime = 0;
  /** @type {Phaser.GameObjects.Image[]} */
  #activeAfterimages = [];
  /** @type {boolean} */
  #catParticleColorToggle = false;
  /** @type {Phaser.GameObjects.Particles.ParticleEmitter | undefined} */
  #catTrailEmitter;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #minimapContainer;
  /** @type {Phaser.GameObjects.Arc | undefined} */
  #minimapPlayerDot;
  /** @type {Array<{ id: number, marker: Phaser.GameObjects.Arc, glow: Phaser.GameObjects.Arc }>} */
  #minimapPortalMarkers = [];
  /** @type {boolean} */
  #isBigMapOpen = false;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #bigMapContainer;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #bigMapDynamicLayer;
  /** @type {boolean} */
  #isF1DebugActive = false;
  /** @type {boolean} */
  #isF2EditorActive = false;
  /** @type {Phaser.GameObjects.Graphics | undefined} */
  #collisionDebugGfx;
  /** @type {Phaser.GameObjects.Graphics | undefined} */
  #feetFootprintGfx;
  /** @type {boolean} */
  #isMissionPromptOpen = false;
  /** @type {number} */
  #lastMissionDeclineTime = 0;
  /** @type {object | null} */
  #activeApeForMission = null;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #missionPromptContainer;
  /** @type {Phaser.GameObjects.Text | undefined} */
  #missionPromptTitleText;
  /** @type {Phaser.GameObjects.Text | undefined} */
  #missionPromptSubtitleText;
  /** @type {Phaser.GameObjects.Text | undefined} */
  #missionPromptTauntText;
  /** @type {Phaser.GameObjects.Text[]} */
  #missionPromptOptions = [];
  /** @type {number} */
  #selectedMissionOption = 0;
  /** @type {Phaser.GameObjects.Container | undefined} */
  #talkIndicatorContainer;

  constructor() {
    super({
      key: SCENE_KEYS.WORLD_SCENE,
    });
  }

  get player() {
    return this.#player;
  }

  get coins() {
    return this.#coins;
  }

  get tokens() {
    return this.#tokens;
  }

  get portals() {
    return this.#portals;
  }

  get hackerApes() {
    return this.#hackerApes;
  }

  get npcs() {
    return this.#npcs;
  }

  get isMissionPromptOpen() {
    return this.#isMissionPromptOpen;
  }

  get selectedMissionOption() {
    return this.#selectedMissionOption;
  }

  get missionPromptContainer() {
    return this.#missionPromptContainer;
  }

  get talkIndicatorContainer() {
    return this.#talkIndicatorContainer;
  }

  get collisionDebugGfx() {
    return this.#collisionDebugGfx;
  }

  get isF1DebugActive() {
    return this.#isF1DebugActive;
  }

  get isF2EditorActive() {
    return this.#isF2EditorActive;
  }

  get lastMissionDeclineTime() {
    return this.#lastMissionDeclineTime;
  }

  openChainHeist() {
    this.#openChainHeistOverlay();
  }

  triggerApeBattle(ape) {
    this.#triggerApeBattle(ape);
  }

  /**
   * @param {WorldSceneData} data
   * @returns {void}
   */
  init(data) {
    super.init(data);
    this.#sceneData = data;
    this.#tiledLevelMaps = {};
    this.#portals = [];
    this.#hackerApes = [];
    this.#isEngagingPortal = false;
    this.#coins = [];
    this.#tokens = [];
    this.#collectedTokenIds = new Set(runState.collectedTokenIds || []);
    this.#isGuideTrailEnabled = true;
    this.#lastGuideTrailCalcTime = 0;
    this.#lastCatAfterimageTime = 0;
    this.#lastCatParticleTime = 0;
    this.#activeAfterimages = [];
    this.#catParticleColorToggle = false;
    this.#minimapPortalMarkers = [];
    this.#isBigMapOpen = false;
    this.#isF1DebugActive = false;
    this.#isF2EditorActive = false;
    this.#lastMissionDeclineTime = 0;
    this.#isMissionPromptOpen = false;
    this.#activeApeForMission = null;
    this.#missionPromptOptions = [];
    this.#selectedMissionOption = 0;

    runState.load();
    TimeManager.load();
    if (runState.cleared.length >= MAX_DISTRICTS || runState.lives <= 0 || TimeManager.worldRemainingMs <= 0) {
      this.scene.start(SCENE_KEYS.RESULTS_SCENE);
      return;
    }

    // handle when some of the fields for scene data are not populated, default to values provided, otherwise use safe defaults
    /** @type {string} */
    const area = this.#sceneData?.area || dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION).area;
    let isInterior = this.#sceneData?.isInterior;
    if (isInterior === undefined) {
      isInterior = dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION).isInterior;
    }
    const isPlayerKnockedOut = this.#sceneData?.isPlayerKnockedOut || false;

    this.#sceneData = {
      area,
      isInterior,
      isPlayerKnockedOut,
    };

    // update player location, and map data if the player was knocked out in a battle
    if (this.#sceneData.isPlayerKnockedOut) {
      // get the nearest knocked out spawn location from the map meta data
      let map = this.#getLevelTileMap(`${this.#sceneData.area.toUpperCase()}_LEVEL`);
      const areaMetaDataProperties = map.getObjectLayer(OBJECT_LAYER_NAMES.AREA_METADATA).objects[0].properties;
      const knockOutSpawnLocation = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (
        areaMetaDataProperties
      ).find((property) => property.name === TILED_AREA_METADATA_PROPERTY.FAINT_LOCATION)?.value;

      // check to see if the level data we need to load is different and load that map to get player spawn data
      if (knockOutSpawnLocation !== this.#sceneData.area) {
        this.#sceneData.area = knockOutSpawnLocation;
        map = this.#getLevelTileMap(`${this.#sceneData.area.toUpperCase()}_LEVEL`);
      }

      // set players spawn location to that map and finds the revive location based on that object
      const reviveLocation = map.getObjectLayer(OBJECT_LAYER_NAMES.REVIVE_LOCATION).objects[0];
      dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION, {
        x: reviveLocation.x,
        y: reviveLocation.y - TILE_SIZE,
      });
      dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_DIRECTION, DIRECTION.UP);
    }

    // During a new game flow, find the players starting location from the map data, and update
    // the data manager. Originally, this was a hard coded value, and was updated to be dynamic
    // based on our level data in Tiled.
    let isNewGame = !(dataManager.store.get(DATA_MANAGER_STORE_KEYS.GAME_STARTED) || false);
    const map = this.#getLevelTileMap(WORLD_ASSET_KEYS.MAIN_1_LEVEL);
    const playerSpawnLocationObject = map.getObjectLayer(OBJECT_LAYER_NAMES.PLAYER_SPAWN_LOCATION).objects[0];
    const currentPos = dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION);
    if (isNewGame || !currentPos || currentPos.x >= map.widthInPixels || currentPos.y >= map.heightInPixels) {
      dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION, {
        x: DEFAULT_PLAYER_SPAWN.x,
        y: DEFAULT_PLAYER_SPAWN.y,
      });
    }

    dataManager.store.set(
      DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION,
      /** @type {import('../utils/data-manager.js').PlayerLocation} */ ({
        area: this.#sceneData.area,
        isInterior: this.#sceneData.isInterior,
      })
    );

    this.#wildMonsterEncountered = false;
    this.#npcPlayerIsInteractingWith = undefined;
    this.#items = [];
    this.#lastNpcEventHandledIndex = -1;
    this.#isProcessingNpcEvent = false;
    this.#encounterLayers = [];
    this.#signLayer = undefined;
    this.#entranceLayer = undefined;
    this.#eventZones = {};
    this.#debugEventZoneObjects = {};
    this.#rectangleForOverlapCheck1 = undefined;
    this.#rectangleForOverlapCheck2 = undefined;
    this.#rectangleOverlapResult = undefined;
    this.#gfx = undefined;
    this.#currentCutSceneId = undefined;
    this.#isProcessingCutSceneEvent = false;
    this.#lastCutSceneEventHandledIndex = -1;
    this.#specialEncounterTileImageGameObjectGroup = undefined;
    this.#encounterZonePlayerIsEntering = undefined;
    this.#cameraRegions = [];
  }

  /**
   * @returns {void}
   */
  create() {
    super.create();

    // create rectangles for checking for overlaps between game objects, added so we can recycle game objects
    this.#rectangleForOverlapCheck1 = new Phaser.Geom.Rectangle();
    this.#rectangleForOverlapCheck2 = new Phaser.Geom.Rectangle();
    this.#rectangleOverlapResult = new Phaser.Geom.Rectangle();

    // create map and collision layer
    const map = this.#getLevelTileMap(`${this.#sceneData.area.toUpperCase()}_LEVEL`);
    // Initialize pixel-accurate walkmask
    initWalkmask(this, WORLD_ASSET_KEYS.WALKMASK);

    // ===== F1 WALK-MASK DEBUG OVERLAY & F2 WALK-MASK EDITOR =====
    this.#collisionDebugGfx = this.add.graphics().setDepth(9990).setVisible(false);
    this.#feetFootprintGfx = this.add.graphics().setDepth(9995).setVisible(false);
    const debugCoordText = this.add.text(16, 68, '', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#3FF0FF',
      backgroundColor: '#080416dd',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(1000050).setVisible(false);

    let brushRadius = 16;
    let isPainting = false;
    let paintMode = true; // true = walkable (white), false = blocked (black)

    const redrawDebugOverlay = () => {
      if (!this.#collisionDebugGfx) return;
      this.#collisionDebugGfx.clear();
      if (!this.#isF1DebugActive && !this.#isF2EditorActive) return;

      const { data, width, height } = getWalkmaskData();
      if (!data) return;

      // Sample mask at 8px resolution for fast, crisp debug visualization
      // GREEN = walkable, RED = blocked
      const step = 8;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const val = data[y * width + x];
          if (val === 0) {
            // Blocked: semi-transparent red
            this.#collisionDebugGfx.fillStyle(0xFF0033, 0.45);
            this.#collisionDebugGfx.fillRect(x, y, step, step);
          } else {
            // Walkable: subtle green
            this.#collisionDebugGfx.fillStyle(0x00FF66, 0.20);
            this.#collisionDebugGfx.fillRect(x, y, step, step);
          }
        }
      }
    };

    const toggleF1Debug = () => {
      this.#isF1DebugActive = !this.#isF1DebugActive;
      this.#collisionDebugGfx?.setVisible(this.#isF1DebugActive || this.#isF2EditorActive);
      if (this.#isF1DebugActive) {
        redrawDebugOverlay();
      }
    };

    const toggleF2Editor = () => {
      this.#isF2EditorActive = !this.#isF2EditorActive;
      this.#collisionDebugGfx?.setVisible(this.#isF1DebugActive || this.#isF2EditorActive);
      this.#feetFootprintGfx?.setVisible(this.#isF2EditorActive);
      debugCoordText.setVisible(this.#isF2EditorActive);
      if (this.#isF2EditorActive) {
        redrawDebugOverlay();
        debugCoordText.setText(`[F2 EDITOR] LMB=White (Walk) | RMB=Black (Block) | [ / ]=Brush (${brushRadius}px) | S=Save | R=Reload`);
      }
    };

    this.input.keyboard?.on('keydown-F1', (event) => {
      if (event) event.preventDefault();
      toggleF1Debug();
    });

    this.input.keyboard?.on('keydown-F2', (event) => {
      if (event) event.preventDefault();
      toggleF2Editor();
    });

    // Brush size controls
    this.input.keyboard?.on('keydown-OPEN_BRACKET', () => {
      brushRadius = Math.max(4, brushRadius - 4);
    });
    this.input.keyboard?.on('keydown-CLOSED_BRACKET', () => {
      brushRadius = Math.min(64, brushRadius + 4);
    });

    // Save PNG hotkeys 'S' and 'E' while in editor mode
    const saveMask = () => {
      const dataUrl = exportWalkmaskPNG();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'neo-city-walkmask.export.png';
      a.click();
      console.log('[walkmask-editor] Saved/Exported updated neo-city-walkmask.export.png');
    };

    this.input.keyboard?.on('keydown-S', () => {
      if (this.#isF2EditorActive) {
        saveMask();
      }
    });

    this.input.keyboard?.on('keydown-E', () => {
      if (this.#isF2EditorActive) {
        saveMask();
      }
    });

    // Hot-reload mask hotkey 'R'
    this.input.keyboard?.on('keydown-R', () => {
      if (this.#isF2EditorActive) {
        initWalkmask(this, WORLD_ASSET_KEYS.WALKMASK);
        redrawDebugOverlay();
        console.log('[walkmask-editor] Hot-reloaded walkmask from texture');
      }
    });

    // Mouse painting in F2 editor mode: Left = white (walkable), Right = black (blocked)
    this.input.on('pointerdown', (pointer) => {
      if (!this.#isF2EditorActive) return;
      isPainting = true;
      paintMode = !pointer.rightButtonDown(); // LMB = true (walkable/white), RMB = false (blocked/black)
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      paintWalkmask(worldPoint.x, worldPoint.y, brushRadius, paintMode);
      redrawDebugOverlay();
    });

    this.input.on('pointermove', (pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const wx = Math.round(worldPoint.x);
      const wy = Math.round(worldPoint.y);

      if (this.#isF2EditorActive && isPainting) {
        paintWalkmask(worldPoint.x, worldPoint.y, brushRadius, paintMode);
        redrawDebugOverlay();
      }

      if (this.#isF2EditorActive) {
        const walkable = isWalkable(wx, wy);
        debugCoordText.setText(
          `POS: [${wx}, ${wy}] | ${walkable ? 'WALKABLE' : 'BLOCKED'} | BRUSH: ${brushRadius}px (LMB=White/Walk, RMB=Black/Block, [ / ]=Size, S=Save, R=Reload)`
        );
      }
    });

    this.input.on('pointerup', () => {
      isPainting = false;
    });

    // Update debug feet box every frame (YELLOW = player footprint)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.#isF2EditorActive || this.#isF1DebugActive) {
        this.#feetFootprintGfx?.clear();
        if (this.#player?.sprite && this.#feetFootprintGfx) {
          const px = this.#player.sprite.x;
          const py = this.#player.sprite.y;
          this.#feetFootprintGfx.lineStyle(2, 0xFFFF00, 1.0);
          this.#feetFootprintGfx.strokeRect(px - FEET_BOX_WIDTH / 2, py - FEET_BOX_HEIGHT / 2, FEET_BOX_WIDTH, FEET_BOX_HEIGHT);
          this.#feetFootprintGfx.fillStyle(0xFFFF00, 0.4);
          this.#feetFootprintGfx.fillRect(px - FEET_BOX_WIDTH / 2, py - FEET_BOX_HEIGHT / 2, FEET_BOX_WIDTH, FEET_BOX_HEIGHT);
          this.#feetFootprintGfx.fillStyle(0xFFFF00, 1.0);
          this.#feetFootprintGfx.fillCircle(px, py, 3);
        }
      }
    });

    // create interactive layer
    const hasSignLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.SIGN) !== null;
    if (hasSignLayer) {
      this.#signLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.SIGN);
    }

    // create layer for scene transitions entrances
    const hasSceneTransitionLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.SCENE_TRANSITIONS) !== null;
    if (hasSceneTransitionLayer) {
      this.#entranceLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.SCENE_TRANSITIONS);
    }

    // create collision layers for encounters
    this.#createEncounterAreas(map);

    if (!this.#sceneData.isInterior) {
      this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    }
    this.cameras.main.setZoom(0.8);
    this.cameras.main.setRoundPixels(true);

    // Particle emitter texture for walking trail
    if (!this.textures.exists('trail-pixel-2x2')) {
      const pGfx = this.make.graphics({ x: 0, y: 0 }, false);
      pGfx.fillStyle(0xFFFFFF, 1);
      pGfx.fillRect(0, 0, 2, 2);
      pGfx.generateTexture('trail-pixel-2x2', 2, 2);
      pGfx.destroy();
    }

    this.#catTrailEmitter = this.add.particles(0, 0, 'trail-pixel-2x2', {
      lifespan: 400,
      alpha: { start: 0.9, end: 0 },
      scale: 1,
      emitting: false,
      maxAliveParticles: 20,
    }).setDepth(5);

    // draw the image layer at depth 0 with pixel-art scaling
    const bgKey = this.textures.exists('neo-city') ? 'neo-city' : `${this.#sceneData.area.toUpperCase()}_BACKGROUND`;
    const bgImage = this.add.image(0, 0, bgKey, 0).setOrigin(0).setDepth(0);
    if (bgImage && bgImage.texture) {
      bgImage.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      // Night colour grade: tint world towards dark navy + violet
      bgImage.setTint(0xA698D8);
    }

    // Foreground layer at depth 100000 (empty 1920x1152 transparent placeholder until real occluders authored)
    const fgKey = WORLD_ASSET_KEYS.MAIN_1_FOREGROUND;
    if (this.textures.exists(fgKey)) {
      const fgImage = this.add.image(0, 0, fgKey, 0).setOrigin(0).setDepth(100000);
      if (fgImage && fgImage.texture) {
        fgImage.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    // Create portals as glowing neon rings and spawn Hacker Ape trainers next to each
    this.#createPortalsAndApes(map);

    // Create Coins and Tokens
    this.#createCoinsAndTokens(map);

    // create items and collisions
    this.#createItems(map);

    // create npcs
    this.#createNPCs(map);

    // create player and have camera focus on the player
    this.#player = new Player({
      scene: this,
      position: dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION),
      direction: dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_DIRECTION),
      spriteGridMovementFinishedCallback: () => {
        this.#handlePlayerMovementUpdate();
      },
      spriteChangedDirectionCallback: () => {
        this.#handlePlayerDirectionUpdate();
      },
      otherCharactersToCheckForCollisionsWith: this.#npcs,
      objectsToCheckForCollisionsWith: this.#items,
      entranceLayer: this.#entranceLayer,
      enterEntranceCallback: (entranceName, entranceId, isBuildingEntrance) => {
        this.#handleEntranceEnteredCallback(entranceName, entranceId, isBuildingEntrance);
      },
      spriteGridMovementStartedCallback: (position) => {
        this.#handlePlayerMovementStarted(position);
      },
    });
    this.cameras.main.startFollow(this.#player.sprite);

    // update camera bounds for the given level
    this.#cameraRegions = TiledUtils.createCameraRegions(map);
    CameraUtils.updateMainCameraBounds(this, this.#player.sprite, this.#cameraRegions);

    // update our collisions with npcs
    this.#npcs.forEach((npc) => {
      npc.addCharacterToCheckForCollisionsWith(this.#player);
    });

    // create menu
    this.#menu = new WorldMenu(this);

    // create event zones
    this.#createEventEncounterZones(map);

    if (ENABLE_ZONE_DEBUGGING) {
      // used for debugging the overlaps for event zones
      this.#gfx = this.add.graphics({ lineStyle: { width: 4, color: 0x00ffff } });
    }

    this.cameras.main.fadeIn(1000, 0, 0, 0, (camera, progress) => {
      if (progress === 1) {
        // if the player was knocked out, we want to lock input, heal player, and then have npc show message
        if (this.#sceneData.isPlayerKnockedOut) {
          this.#healPlayerParty();
          this.#dialogUi.showDialogModal([
            'It looks like your team put up quite a fight...',
            'I went ahead and healed them up for you.',
          ]);
        }
      }
    });
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.GAME_STARTED, true);

    // add audio
    playBackgroundMusic(this, AUDIO_ASSET_KEYS.MAIN);
    // add UI scene for cutscene and dialog
    this.scene.launch(SCENE_KEYS.CUTSCENE_SCENE);
    this.scene.launch(SCENE_KEYS.DIALOG_SCENE);
    this.#dialogUi = /** @type {DialogScene} */ (this.scene.get(SCENE_KEYS.DIALOG_SCENE));
    this.#specialEncounterTileImageGameObjectGroup = this.add.group({ classType: Phaser.GameObjects.Image });

    runState.load();
    TimeManager.load();
    runState.startTimer();
    this.#createRunHud();
    this.#createPauseMenu();

    // Create Minimap (top-right ~160px wide, cyan neon border, dark frame)
    this.#createMinimap();

    // Create Big Map View (centered dialog, toggled with M)
    this.#createBigMap();

    // Create Guide Trail
    this.#createGuideTrail();

    // Cyberpunk visual polish: night colour grade, player glow, floating neon particles, scanlines
    this.#createCyberpunkPolish(map);

    // Create floating [SPACE] TALK indicator
    this.#createTalkIndicator();

    // Create 2-option mission confirmation prompt
    this.#createMissionConfirmationPrompt();

    // T toggles guide trail
    this.input.keyboard?.on('keydown-T', () => {
      this.#toggleGuideTrail();
    });

    // M toggles big centred map view (pauses game while open)
    this.input.keyboard?.on('keydown-M', () => {
      if (this.#dialogUi?.isVisible || this.#menu?.isVisible || this.#isGamePaused || this.#isMissionPromptOpen) {
        return;
      }
      this.#toggleBigMap();
    });

    // R toggles reduce motion
    this.input.keyboard?.on('keydown-R', () => {
      runState.toggleReduceMotion();
      this.#updateGuideTrail();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.#isMissionPromptOpen) {
        this.#closeMissionConfirmation();
        return;
      }
      if (this.#isBigMapOpen) {
        this.#toggleBigMap();
        return;
      }
      this.#togglePauseMenu();
    });

    this.input.keyboard?.on('keydown-W', () => {
      if (this.#isMissionPromptOpen) {
        this.#selectedMissionOption = 0;
        this.#updateMissionPromptUI();
        return;
      }
      if (this.#isGamePaused) {
        this.#selectedPauseOption = 0;
        this.#updatePauseMenuUI();
      }
    });

    this.input.keyboard?.on('keydown-S', () => {
      if (this.#isMissionPromptOpen) {
        this.#selectedMissionOption = 1;
        this.#updateMissionPromptUI();
        return;
      }
      if (this.#isGamePaused) {
        this.#selectedPauseOption = 1;
        this.#updatePauseMenuUI();
      }
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.#isMissionPromptOpen) {
        this.#selectedMissionOption = 0;
        this.#updateMissionPromptUI();
        return;
      }
      if (this.#isGamePaused) {
        this.#selectedPauseOption = 0;
        this.#updatePauseMenuUI();
      }
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.#isMissionPromptOpen) {
        this.#selectedMissionOption = 1;
        this.#updateMissionPromptUI();
        return;
      }
      if (this.#isGamePaused) {
        this.#selectedPauseOption = 1;
        this.#updatePauseMenuUI();
      }
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.#isMissionPromptOpen) {
        this.#executeMissionOption();
        return;
      }
      if (this.#isGamePaused) {
        this.#executePauseOption();
      }
    });

    // Enumerate every game object spanning the map (images, tilemap layers, graphics, rectangles, render textures)
    console.log('[MAP-AUDIT] --- Enumerate Map-Spanning Objects ---');
    this.children.list.forEach((child) => {
      const c = /** @type {any} */ (child);
      const w = c.width || c.displayWidth || 0;
      const h = c.height || c.displayHeight || 0;
      if (w >= 1000 || h >= 1000 || c.isTilemapLayer) {
        const key = c.texture?.key || c.name || c.type || 'N/A';
        const depth = c.depth;
        const alpha = c.alpha !== undefined ? c.alpha : 1;
        const tint = c.tintTopLeft !== undefined ? `0x${c.tintTopLeft.toString(16)}` : 'NONE';
        const blendMode = c.blendMode;
        const visible = c.visible;
        console.log(`[MAP-AUDIT] Key: ${key}, Depth: ${depth}, Alpha: ${alpha}, Tint: ${tint}, BlendMode: ${blendMode}, Visible: ${visible}`);
      }
    });
    console.log('[MAP-AUDIT] --- End Audit ---');
  }

  /**
   * @param {DOMHighResTimeStamp} time
   * @param {number} [delta=16.66]
   * @returns {void}
   */
  update(time, delta = 16.66) {
    super.update(time);

    // Pause timer when a dialog, world menu, pause menu, big map, or mission prompt is active
    const isDialogActive = Boolean(this.#dialogUi?.isVisible);
    const isMenuActive = Boolean(this.#menu?.isVisible);
    const isPaused = this.#isGamePaused || this.#isBigMapOpen || isDialogActive || isMenuActive || this.#isMissionPromptOpen;

    if (isPaused) {
      runState.pauseTimer();
    } else {
      runState.resumeTimer();
      const deltaSec = delta / 1000;
      const timeExpired = runState.tick(deltaSec);
      if (timeExpired) {
        this.scene.start(SCENE_KEYS.RESULTS_SCENE);
        return;
      }
    }

    this.#updateRunHud(time);
    this.#updateMinimap();

    if (this.#isBigMapOpen) {
      return;
    }

    if (!isPaused) {
      this.#checkCoinCollection();

      // Guide trail update check
      if (this.#isGuideTrailEnabled && !isReduceMotionActive()) {
        if (time - this.#lastGuideTrailCalcTime > 300) {
          this.#lastGuideTrailCalcTime = time;
          this.#updateGuideTrail();
        }
      } else if (this.#guideTrailContainer && this.#guideTrailContainer.visible) {
        this.#guideTrailContainer.setVisible(false);
      }

      // Cat walking trail (afterimage + pixel particles)
      if (this.#player && this.#player.isMoving && !isReduceMotionActive()) {
        this.#spawnCatWalkTrail(time);
      }
    }

    if (this.#isGamePaused) {
      const dirPressed = this._controls.getDirectionKeyJustPressed();
      if (dirPressed === DIRECTION.UP) {
        this.#selectedPauseOption = 0;
        this.#updatePauseMenuUI();
      } else if (dirPressed === DIRECTION.DOWN) {
        this.#selectedPauseOption = 1;
        this.#updatePauseMenuUI();
      }

      if (this._controls.wasSpaceKeyPressed() || this._controls.wasEnterKeyPressed()) {
        this.#executePauseOption();
      }
      return;
    }

    if (this.#isMissionPromptOpen) {
      const dirPressed = this._controls.getDirectionKeyJustPressed();
      if (dirPressed === DIRECTION.UP) {
        this.#selectedMissionOption = 0;
        this.#updateMissionPromptUI();
      } else if (dirPressed === DIRECTION.DOWN) {
        this.#selectedMissionOption = 1;
        this.#updateMissionPromptUI();
      }

      if (this._controls.wasSpaceKeyPressed() || this._controls.wasEnterKeyPressed()) {
        this.#executeMissionOption();
      }
      return;
    }

    // Update floating [SPACE] TALK indicator for nearby Hacker Apes
    this.#updateApeInteractionIndicator();

    if (this.#wildMonsterEncountered) {
      this.#player.update(time, delta);
      return;
    }

    const wasSpaceKeyPressed = this._controls.wasSpaceKeyPressed();
    const selectedDirectionHeldDown = this._controls.getDirectionKeyPressedDown();
    const selectedDirectionPressedOnce = this._controls.getDirectionKeyJustPressed();
    const isShiftKeyDown = this._controls.isShiftKeyDown();
    const movementVector = this._controls.getMovementVector();

    if (this.#isProcessingCutSceneEvent) {
      this.#player.update(time, delta);
      this.#npcs.forEach((npc) => {
        npc.update(time);
      });
      if (wasSpaceKeyPressed && this.#npcPlayerIsInteractingWith) {
        this.#handlePlayerInteraction();
      }
      return;
    }

    if ((movementVector.x !== 0 || movementVector.y !== 0 || selectedDirectionHeldDown !== DIRECTION.NONE) && !this.#isPlayerInputLocked()) {
      let faceDir = selectedDirectionHeldDown;
      if (movementVector.x < 0) faceDir = DIRECTION.LEFT;
      else if (movementVector.x > 0) faceDir = DIRECTION.RIGHT;
      else if (movementVector.y < 0) faceDir = DIRECTION.UP;
      else if (movementVector.y > 0) faceDir = DIRECTION.DOWN;

      this.#player.moveCharacter(faceDir, isShiftKeyDown, movementVector);
    }

    if (wasSpaceKeyPressed && !this.#menu.isVisible) {
      this.#handlePlayerInteraction();
    }

    if (this._controls.wasEnterKeyPressed() && !this.#player.isMoving) {
      if (this.#dialogUi.isVisible || this.#isProcessingNpcEvent) {
        return;
      }

      if (this.#menu.isVisible) {
        this.#menu.hide();
        return;
      }

      this.#menu.show();
    }

    if (this.#menu.isVisible) {
      if (selectedDirectionPressedOnce !== DIRECTION.NONE) {
        this.#menu.handlePlayerInput(selectedDirectionPressedOnce);
      }

      if (wasSpaceKeyPressed) {
        this.#menu.handlePlayerInput('OK');

        if (this.#menu.selectedMenuOption === 'SAVE') {
          this.#menu.hide();
          dataManager.saveData();
          this.#dialogUi.showDialogModal(['Game progress has been saved']);
        }

        if (this.#menu.selectedMenuOption === 'MONSTERS') {
          // at start of the game, handle when we have no monsters in our party
          if (dataManager.store.get(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY).length === 0) {
            this.#dialogUi.showDialogModal(['You have no monsters in your party.']);
            this.#menu.hide();
            return;
          }

          // pause this scene and launch the monster party scene
          /** @type {import('./monster-party-scene.js').MonsterPartySceneData} */
          const sceneDataToPass = {
            previousSceneName: SCENE_KEYS.WORLD_SCENE,
          };
          this.scene.launch(SCENE_KEYS.MONSTER_PARTY_SCENE, sceneDataToPass);
          this.scene.pause(SCENE_KEYS.WORLD_SCENE);
        }

        if (this.#menu.selectedMenuOption === 'BAG') {
          // pause this scene and launch the inventory scene
          /** @type {import('./inventory-scene.js').InventorySceneData} */
          const sceneDataToPass = {
            previousSceneName: SCENE_KEYS.WORLD_SCENE,
            itemCategoriesThatCannotBeUsed: [ITEM_CATEGORY.CAPTURE],
          };
          this.scene.launch(SCENE_KEYS.INVENTORY_SCENE, sceneDataToPass);
          this.scene.pause(SCENE_KEYS.WORLD_SCENE);
        }

        if (this.#menu.selectedMenuOption === 'EXIT') {
          this.#menu.hide();
        }
      }

      if (this._controls.wasBackKeyPressed()) {
        this.#menu.hide();
      }
    }

    this.#player.update(time, delta);

    this.#npcs.forEach((npc) => {
      npc.update(time);
    });
  }

  /**
   * Builds the fixed HUD overlay displaying Hearts, Score, 3 Portals, and Countdown Timer.
   * @returns {void}
   */
  #createRunHud() {
    this.#hudContainer = this.add.container(16, 14);
    this.#hudContainer.setScrollFactor(0).setDepth(1000000);

    const hudWidth = 730;
    const hudHeight = 44;

    // Dark panel with cyan border
    const panelBg = this.add.rectangle(0, 0, hudWidth, hudHeight, 0x080416, 0.92)
      .setOrigin(0)
      .setStrokeStyle(2, 0x3FF0FF, 0.95);

    // Inner subtle glow accent
    const innerBar = this.add.rectangle(2, hudHeight - 3, hudWidth - 4, 2, 0x3FF0FF, 0.35)
      .setOrigin(0);

    // 1. Hearts
    this.#hudHeartTexts = [];
    for (let i = 0; i < 3; i++) {
      const heart = this.add.text(18 + i * 22, hudHeight / 2, '♥', {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '22px',
        color: '#FF2A6D',
      }).setOrigin(0, 0.5);
      this.#hudHeartTexts.push(heart);
    }

    // Divider 1
    const div1 = this.add.graphics();
    div1.lineStyle(1, 0x3FF0FF, 0.4);
    div1.lineBetween(90, 8, 90, hudHeight - 8);

    // 2. Score
    this.#hudScoreText = this.add.text(104, hudHeight / 2, 'SCORE 000000', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Divider 2
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x3FF0FF, 0.4);
    div2.lineBetween(248, 8, 248, hudHeight - 8);

    // 3. Tokens Count x/10
    this.#hudTokensText = this.add.text(262, hudHeight / 2, 'TOKENS 0/10', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '14px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Divider 3
    const div3 = this.add.graphics();
    div3.lineStyle(1, 0x3FF0FF, 0.4);
    div3.lineBetween(386, 8, 386, hudHeight - 8);

    // 4. 4 Portal Markers: grey -> green when cleared
    const portalLabel = this.add.text(390, hudHeight / 2, 'PORTALS:', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
    }).setOrigin(0, 0.5);

    this.#hudPortalTexts = [];
    const portalTags = ['[1]', '[2]', '[3]', '[4]'];
    portalTags.forEach((tag, idx) => {
      const pText = this.add.text(454 + idx * 34, hudHeight / 2, tag, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '14px',
        color: '#666677',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.#hudPortalTexts.push(pText);
    });

    // Divider 4
    const div4 = this.add.graphics();
    div4.lineStyle(1, 0x3FF0FF, 0.4);
    div4.lineBetween(596, 8, 596, hudHeight - 8);

    // 5. Timer
    this.#hudTimerText = this.add.text(612, hudHeight / 2, '⏱ 07:00', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.#hudContainer.add([
      panelBg,
      innerBar,
      ...this.#hudHeartTexts,
      div1,
      this.#hudScoreText,
      div2,
      this.#hudTokensText,
      div3,
      portalLabel,
      ...this.#hudPortalTexts,
      div4,
      this.#hudTimerText,
    ]);
  }

  /**
   * Refreshes HUD values every frame
   * @param {number} time
   * @returns {void}
   */
  #updateRunHud(time) {
    if (!this.#hudContainer) return;

    // 1. Hearts
    const lives = Math.max(0, Math.min(3, runState.lives));
    for (let i = 0; i < 3; i++) {
      if (i < lives) {
        this.#hudHeartTexts[i].setColor('#FF2A6D').setAlpha(1);
      } else {
        this.#hudHeartTexts[i].setColor('#3A284C').setAlpha(0.6);
      }
    }

    // 2. Score
    this.#hudScoreText.setText(`SCORE ${String(runState.score).padStart(6, '0')}`);

    // 3. Tokens Count
    if (this.#hudTokensText) {
      this.#hudTokensText.setText(`TOKENS ${runState.tokensFound}/10`);
    }

    // 4. Portal markers (grey -> green when cleared)
    for (let i = 0; i < MAX_DISTRICTS; i++) {
      const portalId = i + 1;
      const isCleared = runState.cleared.includes(portalId);
      if (this.#hudPortalTexts[i]) {
        this.#hudPortalTexts[i].setColor(isCleared ? '#00FF66' : '#666677');
      }
    }

    // 4. Timer (turns red and flickers under 1:00)
    const timeFormatted = runState.getFormattedTime();
    this.#hudTimerText.setText(`⏱ ${timeFormatted}`);

    if (runState.timeRemaining < 60) {
      this.#hudTimerText.setColor('#FF3366');
      const isFlickerDim = Math.floor(time / 200) % 2 === 0;
      this.#hudTimerText.setAlpha(isFlickerDim ? 0.25 : 1);
    } else {
      this.#hudTimerText.setColor('#3FF0FF');
      this.#hudTimerText.setAlpha(1);
    }
  }

  /**
   * Draws the portals as glowing neon rotating rings with floating labels,
   * and spawns a Hacker Ape trainer next to each portal.
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createPortalsAndApes(map) {
    const portalsLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.PORTALS);
    if (!portalsLayer || !portalsLayer.objects) return;

    this.#portals = [];
    this.#hackerApes = [];

    const portalMeta = {
      blockFlyer: {
        id: 1,
        label: 'BLOCK FLYER',
        district: 'BLOCK DISTRICT',
        apeAsset: 'HACKER_APE_1',
        apeOffsetX: -64,
        apeOffsetY: 0,
        taunt: "HACKER APE: Think your ping is fast enough for the BLOCK FLYER? You're about to get liquidated!",
      },
      vaultRun: {
        id: 2,
        label: 'VAULT RUN',
        district: 'VAULT DISTRICT',
        apeAsset: 'HACKER_APE_2',
        apeOffsetX: -64,
        apeOffsetY: 0,
        taunt: "HACKER APE: Private keys stay private! You'll never crack the VAULT RUN protocol!",
      },
      chainSnake: {
        id: 3,
        label: 'CHAIN SNAKE',
        district: 'CHAIN SNAKE',
        apeAsset: 'HACKER_APE_3',
        apeOffsetX: 64,
        apeOffsetY: 0,
        taunt: "HACKER APE: Sssnakesss on the blockchain! My CHAIN SNAKE will choke your gas fees!",
      },
      chainHeist: {
        id: 4,
        label: 'CHAIN HEIST',
        district: 'MARKET DISTRICT',
        apeAsset: 'HACKER_APE_1',
        apeOffsetX: 28,
        apeOffsetY: 20,
        taunt: "CHAIN HEIST OPERATIVE: The blockchain timeline has been breached! Tamper with the chain, outrun the network, and rewrite history!",
      },
    };

    portalsLayer.objects.forEach((obj) => {
      const gameProp = obj.properties?.find((p) => p.name === 'game')?.value || obj.name;
      const meta = portalMeta[gameProp] || portalMeta.blockFlyer;
      const portalId = meta.id;
      const isCleared = runState.cleared.includes(portalId);

      const rawCx = obj.x + (obj.width ? obj.width / 2 : 32);
      const rawCy = obj.y + (obj.height ? obj.height / 2 : 32);
      const reachablePortal = findNearestReachable(rawCx, rawCy, `Portal [${meta.label}]`);
      const cx = reachablePortal.x;
      const cy = reachablePortal.y;

      // 1. Draw glowing neon ring (rotating, pulsing) - depth sorted by cy
      const ringContainer = this.add.container(cx, cy).setDepth(cy);
      const ringColor = isCleared ? 0x00FF66 : 0x00E5FF;
      const ringColorHex = isCleared ? '#00FF66' : '#3FF0FF';

      // Outer glow pulse circle
      const outerGlow = this.add.graphics();
      outerGlow.lineStyle(2, ringColor, 0.75);
      outerGlow.strokeCircle(0, 0, 32);

      // Rotating dashed ring segments
      const segmentGraphics = this.add.graphics();
      segmentGraphics.lineStyle(2, ringColor, 0.95);
      for (let a = 0; a < 4; a++) {
        const startRad = Phaser.Math.DegToRad(a * 90 + 10);
        const endRad = Phaser.Math.DegToRad(a * 90 + 75);
        segmentGraphics.beginPath();
        segmentGraphics.arc(0, 0, 20, startRad, endRad, false);
        segmentGraphics.strokePath();
      }

      // Inner glowing core
      const core = this.add.circle(0, 0, 7, ringColor, 0.4);
      core.setStrokeStyle(1.5, ringColor, 0.9);

      ringContainer.add([outerGlow, segmentGraphics, core]);

      // Pulsing tween
      this.tweens.add({
        targets: outerGlow,
        scaleX: { from: 0.9, to: 1.15 },
        scaleY: { from: 0.9, to: 1.15 },
        alpha: { from: 0.6, to: 1 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Rotating tween
      this.tweens.add({
        targets: segmentGraphics,
        angle: 360,
        duration: 3000,
        repeat: -1,
      });

      // Floating label
      const floatingLabel = this.add.text(cx, cy - 42, meta.label, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '13px',
        color: ringColorHex,
        fontStyle: 'bold',
        stroke: '#040a18',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(cy + 10);

      this.tweens.add({
        targets: floatingLabel,
        y: cy - 48,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // 2. Spawn Hacker Ape trainer NPC next to portal
      const apeX = cx + meta.apeOffsetX;
      const apeY = cy + meta.apeOffsetY;

      // If already cleared, step aside
      const finalApeX = isCleared ? apeX + 48 : apeX;
      const finalApeY = isCleared ? apeY - 48 : apeY;
      const rawFeetX = finalApeX;
      const rawFeetY = finalApeY + 30;
      const reachableApe = findNearestReachable(rawFeetX, rawFeetY, `Hacker Ape [${meta.label}]`);
      const feetX = reachableApe.x;
      const feetY = reachableApe.y;

      // Soft oval shadow under character: ~28x8 px, black at 35% opacity
      const apeShadow = this.add.ellipse(feetX, feetY, 28, 8, 0x000000, isCleared ? 0.2 : 0.35)
        .setDepth(feetY - 0.1);

      // Ape guard: ~48-52 px tall (31x50 px), crisp pixelArt, feet on tile
      const apeSprite = this.add.image(feetX, feetY, meta.apeAsset)
        .setOrigin(0.5, 1.0)
        .setDisplaySize(31, 50)
        .setDepth(feetY);

      if (apeSprite.texture) {
        apeSprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }

      if (isCleared) {
        apeSprite.setAlpha(0.65);
      } else if (!isReduceMotionActive()) {
        // Idle bob tween: 3px up and down
        this.tweens.add({
          targets: apeSprite,
          y: feetY - 3,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      const apeData = {
        portalId: portalId,
        game: gameProp,
        districtName: meta.district,
        label: meta.label,
        taunt: meta.taunt,
        sprite: apeSprite,
        baseX: apeX,
        baseY: apeY,
        portalX: cx,
        portalY: cy,
        assetKey: meta.apeAsset,
        isCleared: isCleared,
        interactionRadius: NPC_INTERACTION_RADIUS,
      };

      this.#hackerApes.push(apeData);
      this.#portals.push({
        id: portalId,
        label: meta.label,
        cx,
        cy,
        game: gameProp,
        ringContainer,
        floatingLabel,
        isCleared,
      });
    });
  }

  /**
   * Initializes Coins and Tokens from the map's object layers
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createCoinsAndTokens(map) {
    this.#coins = [];
    this.#tokens = [];

    // 1. Coins Layer
    const coinsLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.COINS);
    if (coinsLayer && coinsLayer.objects) {
      coinsLayer.objects.forEach((obj, idx) => {
        const rawCx = obj.x + 32;
        const rawCy = obj.y + 32;
        const reachablePos = findNearestReachable(rawCx, rawCy, `Coin #${idx + 1}`);
        const cx = reachablePos.x;
        const cy = reachablePos.y;

        const coinContainer = this.add.container(cx, cy).setDepth(6);

        // Small soft gold halo (~1.5x coin size, 25% opacity, pulsing gently)
        const glow = this.add.circle(0, 0, 17, 0xFFD700, 0.25);
        if (!isReduceMotionActive()) {
          this.tweens.add({
            targets: glow,
            scale: { from: 0.92, to: 1.08 },
            alpha: { from: 0.20, to: 0.28 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }

        // Gold coin sprite: ~22-24 px wide
        const sprite = this.add.image(0, 0, 'coin-btc-gold').setDisplaySize(23, 23);
        if (sprite.texture) {
          sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }

        // Tiny white sparkle pixel (2x2 px) flashes every ~2-3s
        const sparkle = this.add.rectangle(5, -5, 2, 2, 0xFFFFFF).setAlpha(0);

        if (!isReduceMotionActive()) {
          const scheduleSparkle = () => {
            if (!coinContainer || !coinContainer.scene) return;
            const interval = Phaser.Math.Between(2000, 3000);
            this.time.delayedCall(interval, () => {
              if (!coinContainer || !coinContainer.scene) return;
              sparkle.setAlpha(1);
              this.time.delayedCall(120, () => {
                if (!sparkle || !sparkle.scene) return;
                sparkle.setAlpha(0);
                scheduleSparkle();
              });
            });
          };
          scheduleSparkle();
        }

        coinContainer.add([glow, sprite, sparkle]);
        if (sprite.postFX) {
          sprite.postFX.addGlow(0xFFD700, 2, 0, false, 0.1, 8);
        }

        // Keep the bob: 3 px up and down, ~1.4s loop, random phase per coin
        if (!isReduceMotionActive()) {
          this.tweens.add({
            targets: coinContainer,
            y: cy - 3,
            duration: 700,
            yoyo: true,
            repeat: -1,
            delay: Math.random() * 1400,
            ease: 'Sine.easeInOut',
          });
        }

        this.#coins.push({
          id: obj.id,
          name: obj.name,
          x: cx,
          y: cy,
          container: coinContainer,
          collected: false,
        });
      });
    }

    // 2. Tokens Layer (invisible)
    const tokensLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.TOKENS);
    if (tokensLayer && tokensLayer.objects) {
      tokensLayer.objects.forEach((obj, idx) => {
        const rawCx = obj.x + 32;
        const rawCy = obj.y + 32;
        const reachablePos = findNearestReachable(rawCx, rawCy, `Token #${idx + 1}`);
        const cx = reachablePos.x;
        const cy = reachablePos.y;
        this.#tokens.push({
          id: obj.id,
          name: obj.name,
          tileX: cx - 32,
          tileY: cy - 32,
          centerX: cx,
          centerY: cy,
        });
      });
    }
  }

  /**
   * Checks if player has walked over any uncollected coin
   * @returns {void}
   */
  #checkCoinCollection() {
    if (!this.#player || !this.#coins || this.#coins.length === 0) return;

    const px = this.#player.sprite.x;
    const py = this.#player.sprite.y - 16;

    for (let i = 0; i < this.#coins.length; i++) {
      const coin = this.#coins[i];
      if (coin.collected) continue;

      const dist = Phaser.Math.Distance.Between(px, py, coin.x, coin.y);
      if (dist < 40) {
        this.#collectCoin(coin, i);
      }
    }
  }

  /**
   * Collects a coin: +10 score, pop animation, particle burst, rising "+10" text, coin sound
   * @param {any} coin
   * @param {number} [index]
   * @returns {void}
   */
  #collectCoin(coin, index) {
    coin.collected = true;
    ScoreManager.addCoin();
    this.#playCoinSound();

    // 1. Scale to 1.4x and fade in 150 ms
    this.tweens.add({
      targets: coin.container,
      scale: 1.4,
      alpha: 0,
      duration: 150,
      ease: 'Power1',
      onComplete: () => {
        coin.container.destroy();
      },
    });

    if (!isReduceMotionActive()) {
      // 2. Burst 6 tiny gold pixel squares (2-3 px)
      const colors = [0xFFD700, 0xFFE066, 0xFFCC00];
      for (let p = 0; p < 6; p++) {
        const angle = (p / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 25 + Math.random() * 20;
        const size = Phaser.Math.Between(2, 3);
        const part = this.add.rectangle(
          coin.x,
          coin.y,
          size,
          size,
          colors[p % colors.length],
          1
        ).setDepth(25);

        this.tweens.add({
          targets: part,
          x: coin.x + Math.cos(angle) * speed,
          y: coin.y + Math.sin(angle) * speed,
          alpha: 0,
          scale: 0.5,
          duration: 250,
          ease: 'Power2',
          onComplete: () => part.destroy(),
        });
      }
    }

    // 3. "+20" in a small pixel font rising 20 px and fading
    const text10 = this.add.text(coin.x, coin.y - 6, `+${COIN_VALUE}`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#080416',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: text10,
      y: coin.y - 26,
      alpha: { from: 1, to: 0 },
      duration: 500,
      ease: 'Power1',
      onComplete: () => text10.destroy(),
    });
  }

  /**
   * Collects a hidden token: +50 score, dialog modal, pops out, hovers, flies to score
   * @param {any} token
   * @returns {void}
   */
  #collectToken(token) {
    this.#collectedTokenIds.add(token.id);
    runState.collectToken(token.id);
    this.#playTokenSound();

    // Show dialog modal
    this.#dialogUi.showDialogModal(['You found a hidden BIT token!']);

    // Spawn floating coin that pops out, hovers, and flies to the HUD score
    const startX = token.centerX;
    const startY = token.centerY;

    const flyContainer = this.add.container(startX, startY).setDepth(1000050);
    const glow = this.add.circle(0, 0, 17, 0x00E5FF, 0.35);
    const coinImg = this.add.image(0, 0, 'coin-btc-gold').setDisplaySize(23, 23);
    if (coinImg.texture) {
      coinImg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    const starGfx = this.add.graphics();
    starGfx.fillStyle(0xFFFFFF, 0.95);
    starGfx.beginPath();
    starGfx.moveTo(0, -7);
    starGfx.lineTo(2, -1);
    starGfx.lineTo(7, 0);
    starGfx.lineTo(2, 1);
    starGfx.lineTo(0, 7);
    starGfx.lineTo(-2, 1);
    starGfx.lineTo(-7, 0);
    starGfx.lineTo(-2, -1);
    starGfx.closePath();
    starGfx.fillPath();
    starGfx.setPosition(12, -12);

    flyContainer.add([glow, coinImg, starGfx]);
    flyContainer.setScale(0.2);

    // Pop out and hover
    this.tweens.add({
      targets: flyContainer,
      y: startY - 40,
      scale: 1.35,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hover wobble
        this.tweens.add({
          targets: flyContainer,
          y: startY - 46,
          duration: 350,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Convert to screen coordinates to fly seamlessly to HUD score
            const screenX = flyContainer.x - this.cameras.main.scrollX;
            const screenY = flyContainer.y - this.cameras.main.scrollY;
            flyContainer.setScrollFactor(0).setPosition(screenX, screenY);

            // Target HUD score position
            const targetScreenX = 140;
            const targetScreenY = 36;

            this.tweens.add({
              targets: flyContainer,
              x: targetScreenX,
              y: targetScreenY,
              scale: 0.55,
              duration: 550,
              ease: 'Power2.easeInOut',
              onComplete: () => {
                flyContainer.destroy();
                this.#playCoinSound();

                // Score punch tween
                if (this.#hudScoreText) {
                  this.tweens.add({
                    targets: this.#hudScoreText,
                    scale: 1.3,
                    duration: 120,
                    yoyo: true,
                    ease: 'Power1',
                  });
                }
              },
            });
          },
        });
      },
    });
  }

  /**
   * Synthesizes a crisp retro 2-tone coin chime using Web Audio
   * @returns {void}
   */
  #playCoinSound() {
    try {
      const audioCtx = (/** @type {any} */ (this.sound))?.context;
      if (!audioCtx || audioCtx.state === 'suspended') {
        audioCtx?.resume?.();
      }
      if (audioCtx) {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // Note 1: B5 (987.77 Hz)
        osc.frequency.setValueAtTime(987.77, now);
        // Note 2: E6 (1318.51 Hz) after 0.08s
        osc.frequency.setValueAtTime(1318.51, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch {
      // Audio fallback safe
    }
  }

  /**
   * Synthesizes a secret / token fanfare sound using Web Audio
   * @returns {void}
   */
  #playTokenSound() {
    try {
      const audioCtx = (/** @type {any} */ (this.sound))?.context;
      if (!audioCtx || audioCtx.state === 'suspended') {
        audioCtx?.resume?.();
      }
      if (audioCtx) {
        const now = audioCtx.currentTime;
        const notes = [587.33, 880, 1174.66, 1760]; // D5, A5, D6, A6
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          gain.gain.setValueAtTime(0.18, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.25);
        });
      }
    } catch {
      // Audio fallback safe
    }
  }

  /**
   * Initializes Guide Trail container
   * @returns {void}
   */
  #createGuideTrail() {
    this.#guideTrailContainer = this.add.container(0, 0).setDepth(3);
    this.#updateGuideTrail();
  }

  /**
   * Toggles guide trail state on/off with T key
   * @returns {void}
   */
  #toggleGuideTrail() {
    this.#isGuideTrailEnabled = !this.#isGuideTrailEnabled;
    this.#updateGuideTrail();
  }

  /**
   * Rebuilds small glowing cyan chevrons along the shortest walkable path to the nearest uncleared portal
   * @returns {void}
   */
  #updateGuideTrail() {
    if (!this.#guideTrailContainer) return;
    this.#guideTrailContainer.removeAll(true);

    if (!this.#isGuideTrailEnabled || isReduceMotionActive()) {
      this.#guideTrailContainer.setVisible(false);
      return;
    }

    const path = this.#findShortestPathToNearestPortal();
    if (!path || path.length < 3) {
      this.#guideTrailContainer.setVisible(false);
      return;
    }

    this.#guideTrailContainer.setVisible(true);

    // Place a small chevron every 2 tiles along the path, at most 8 chevrons
    const chevrons = [];
    for (let i = 2; i < path.length - 1 && chevrons.length < 8; i += 2) {
      chevrons.push({ index: i, gx: path[i][0], gy: path[i][1] });
    }

    const totalChevrons = chevrons.length;
    chevrons.forEach((item, k) => {
      const i = item.index;
      const currGx = item.gx;
      const currGy = item.gy;
      const wx = currGx * 64 + 32;
      const wy = currGy * 64 + 32;

      // Determine orientation pointing towards next tile in path
      const nextIdx = Math.min(path.length - 1, i + 1);
      const [nextGx, nextGy] = path[nextIdx];
      const dx = nextGx - currGx;
      const dy = nextGy - currGy;
      let angle = 0;
      if (dx > 0) angle = 0;
      else if (dx < 0) angle = Math.PI;
      else if (dy > 0) angle = Math.PI / 2;
      else if (dy < 0) angle = -Math.PI / 2;

      // Fade out near the portal (distance from destination)
      const distFromEnd = (path.length - 1) - i;
      const portalFade = Math.min(1, Math.max(0.15, distFromEnd / 4));
      const baseAlpha = 0.40 * portalFade;

      // Small chevron arrow (8-10 px) on the ground, cyan at 40% opacity
      const chevronGfx = this.add.graphics();
      chevronGfx.setPosition(wx, wy);
      chevronGfx.setRotation(angle);

      chevronGfx.lineStyle(2, 0x3FF0FF, 1.0);
      chevronGfx.beginPath();
      chevronGfx.moveTo(-4, -4.5);
      chevronGfx.lineTo(4, 0);
      chevronGfx.lineTo(-4, 4.5);
      chevronGfx.strokePath();

      chevronGfx.setAlpha(baseAlpha);
      this.#guideTrailContainer.add(chevronGfx);

      // Soft "wave" pulse: each chevron brightens in sequence toward the portal, looping every 1.5s
      const waveDelay = (k / Math.max(1, totalChevrons)) * 1500;
      this.tweens.add({
        targets: chevronGfx,
        alpha: { from: baseAlpha, to: Math.min(1.0, baseAlpha * 2.2) },
        duration: 350,
        yoyo: true,
        delay: waveDelay,
        repeat: -1,
        repeatDelay: Math.max(0, 1500 - 350 * 2),
        ease: 'Sine.easeInOut',
      });
    });
  }

  /**
   * Calculates shortest walkable path from player to nearest uncleared portal
   * @returns {Array<[number, number]> | null}
   */
  #findShortestPathToNearestPortal() {
    if (!this.#player || !this.#portals || this.#portals.length === 0) return null;

    const unclearedPortals = this.#portals.filter((p) => !runState.cleared.includes(p.id));
    if (unclearedPortals.length === 0) return null;

    const startGx = Math.floor((this.#player.sprite.x + 32) / 64);
    const startGy = Math.floor((this.#player.sprite.y + 32) / 64);

    let shortestPath = null;

    for (const portal of unclearedPortals) {
      const targetGx = Math.floor(portal.cx / 64);
      const targetGy = Math.floor(portal.cy / 64);

      const path = this.#bfsPath(startGx, startGy, targetGx, targetGy);
      if (path && (!shortestPath || path.length < shortestPath.length)) {
        shortestPath = path;
      }
    }

    return shortestPath;
  }

  /**
   * Breadth-First Search on 64px grid using collision layer
   * @param {number} sx
   * @param {number} sy
   * @param {number} tx
   * @param {number} ty
   * @returns {Array<[number, number]> | null}
   */
  #bfsPath(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [[sx, sy]];

    const queue = [[sx, sy]];
    const visited = new Set([`${sx},${sy}`]);
    const parent = {};

    const maxTilesX = 30;
    const maxTilesY = 18;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();

      if (cx === tx && cy === ty) {
        const path = [];
        let curr = `${tx},${ty}`;
        while (curr) {
          const [px, py] = curr.split(',').map(Number);
          path.unshift([px, py]);
          curr = parent[curr];
        }
        return path;
      }

      const dirs = [
        [0, -1], // UP
        [0, 1],  // DOWN
        [-1, 0], // LEFT
        [1, 0],  // RIGHT
      ];

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx < 0 || nx >= maxTilesX || ny < 0 || ny >= maxTilesY) continue;

        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;

        // Check walkability using single source of truth walkmask
        if (!isWalkable(nx * 64 + 32, ny * 64 + 32)) {
          continue; // blocked
        }

        visited.add(key);
        parent[key] = `${cx},${cy}`;
        queue.push([nx, ny]);
      }
    }

    return null;
  }

  /**
   * Spawns clean walking trail behind the cat (afterimages + 2x2 pixel emitter particles)
   * @param {number} time
   * @returns {void}
   */
  #spawnCatWalkTrail(time) {
    if (!this.#player || !this.#player.catVisual || isReduceMotionActive()) return;
    const catVisual = this.#player.catVisual;

    const isShift = this._controls.isShiftKeyDown();

    // 1. Afterimages: every ~60 ms while moving (40 ms if SHIFT)
    const afterimageInterval = isShift ? 40 : 60;
    if (time - this.#lastCatAfterimageTime >= afterimageInterval) {
      this.#lastCatAfterimageTime = time;

      // Max 4 at once
      while (this.#activeAfterimages.length >= 4) {
        const oldest = this.#activeAfterimages.shift();
        if (oldest && oldest.scene) {
          oldest.destroy();
        }
      }

      // Spawn copy of cat sprite at cat's position, tinted cyan (#3FF0FF), alpha 0.35 (0.45 if SHIFT), additive blend
      const ghost = this.add.image(catVisual.x, catVisual.y, catVisual.texture.key)
        .setOrigin(catVisual.originX, catVisual.originY)
        .setScale(catVisual.scaleX, catVisual.scaleY)
        .setFlipX(catVisual.flipX)
        .setDepth(5) // strictly BELOW the cat (depth 7) and above the ground (depth 0/1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0x3FF0FF)
        .setAlpha(isShift ? 0.45 : 0.35);

      this.#activeAfterimages.push(ghost);

      // Fade it to 0 and shrink it to 0.9x over 250 ms
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        scaleX: catVisual.scaleX * 0.9,
        scaleY: catVisual.scaleY * 0.9,
        duration: 250,
        ease: 'Linear',
        onComplete: () => {
          const idx = this.#activeAfterimages.indexOf(ghost);
          if (idx !== -1) {
            this.#activeAfterimages.splice(idx, 1);
          }
          ghost.destroy();
        },
      });
    }

    // 2. Particles: every ~40 ms, 1 tiny square (2x2 px), alternating cyan and magenta (#FF3FD0),
    // spawned at cat's feet with random offset, drifting slightly opposite movement, fading over 400 ms.
    if (time - this.#lastCatParticleTime >= 40) {
      this.#lastCatParticleTime = time;
      this.#catParticleColorToggle = !this.#catParticleColorToggle;
      const pColor = this.#catParticleColorToggle ? 0x3FF0FF : 0xFF3FD0;

      const ox = Phaser.Math.Between(-3, 3);
      const oy = Phaser.Math.Between(-2, 2);

      let vx = 0;
      let vy = 0;
      switch (this.#player.direction) {
        case DIRECTION.LEFT:
          vx = Phaser.Math.Between(15, 25);
          break;
        case DIRECTION.RIGHT:
          vx = Phaser.Math.Between(-25, -15);
          break;
        case DIRECTION.UP:
          vy = Phaser.Math.Between(15, 25);
          break;
        case DIRECTION.DOWN:
          vy = Phaser.Math.Between(-25, -15);
          break;
        default:
          vy = 15;
      }

      if (this.#catTrailEmitter) {
        this.#catTrailEmitter.setParticleTint(pColor);
        this.#catTrailEmitter.setParticleSpeed(vx, vy);
        this.#catTrailEmitter.emitParticleAt(catVisual.x + ox, catVisual.y + oy, 1);
      }
    }
  }

  /**
   * Creates the floating [SPACE] TALK indicator container
   * @returns {void}
   */
  #createTalkIndicator() {
    this.#talkIndicatorContainer = this.add.container(0, 0).setDepth(1000000).setVisible(false);

    // Pill background
    const pillBg = this.add.rectangle(0, 0, 84, 22, 0x070415, 0.95)
      .setStrokeStyle(1.5, 0x3FF0FF, 1);

    // Text "[SPACE] TALK"
    const pillText = this.add.text(0, 0, '[SPACE] TALK', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.#talkIndicatorContainer.add([pillBg, pillText]);

    // Gentle floating bob
    this.tweens.add({
      targets: this.#talkIndicatorContainer,
      y: '-=4',
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Updates floating [SPACE] TALK indicator position and visibility
   * @returns {void}
   */
  #updateApeInteractionIndicator() {
    if (!this.#talkIndicatorContainer) return;

    if (this.#isMissionPromptOpen || this.#isGamePaused || !this.#player || this.#dialogUi?.isVisible) {
      this.#talkIndicatorContainer.setVisible(false);
      return;
    }

    const px = this.#player.sprite.x;
    const py = this.#player.sprite.y;

    let nearestApe = null;
    let minDist = Infinity;

    for (const ape of this.#hackerApes) {
      if (runState.cleared.includes(ape.portalId)) continue;
      const dist = Phaser.Math.Distance.Between(px, py, ape.sprite.x, ape.sprite.y);
      if (dist <= (ape.interactionRadius || NPC_INTERACTION_RADIUS) && dist < minDist) {
        minDist = dist;
        nearestApe = ape;
      }
    }

    if (nearestApe) {
      // Position above the ape's head
      this.#talkIndicatorContainer.setPosition(nearestApe.sprite.x, nearestApe.sprite.y - 56);
      this.#talkIndicatorContainer.setVisible(true);
    } else {
      this.#talkIndicatorContainer.setVisible(false);
    }
  }

  /**
   * Builds the modal 2-option mission confirmation prompt
   * @returns {void}
   */
  #createMissionConfirmationPrompt() {
    const width = 1024;
    const height = 576;

    this.#missionPromptContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(1000020).setVisible(false);

    // Dark backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x05030e, 0.82)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerdown', () => {
      this.#closeMissionConfirmation();
    });

    // Dialog Box
    const boxWidth = 520;
    const boxHeight = 290;
    const boxX = width / 2;
    const boxY = height / 2;

    const modalBox = this.add.rectangle(boxX, boxY, boxWidth, boxHeight, 0x0e0a24, 0.98)
      .setStrokeStyle(2, 0x3FF0FF, 1);

    const cornerDecor = this.add.graphics();
    cornerDecor.lineStyle(2, 0xFF3366, 0.8);
    cornerDecor.strokeRect(boxX - boxWidth / 2 - 4, boxY - boxHeight / 2 - 4, boxWidth + 8, boxHeight + 8);

    this.#missionPromptTitleText = this.add.text(boxX, boxY - 95, '// DISTRICT OVERRIDE PROTOCOL //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '20px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.#missionPromptSubtitleText = this.add.text(boxX, boxY - 65, 'SECURE DISTRICT DATA NODE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#8E8AAB',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const apeTauntBox = this.add.rectangle(boxX, boxY - 15, boxWidth - 48, 55, 0x060312, 0.9)
      .setStrokeStyle(1, 0x3FF0FF, 0.35);

    this.#missionPromptTauntText = this.add.text(boxX, boxY - 15, '', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#FFE600',
      align: 'center',
      wordWrap: { width: boxWidth - 64 },
    }).setOrigin(0.5);

    // Option 0: START MISSION
    const optStart = this.add.text(boxX, boxY + 45, '▶  [ START MISSION ]', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '16px',
      color: '#00FF66',
      fontStyle: 'bold',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.#selectedMissionOption = 0;
        this.#updateMissionPromptUI();
      })
      .on('pointerdown', () => {
        this.#selectedMissionOption = 0;
        this.#executeMissionOption();
      });

    // Option 1: NOT NOW
    const optCancel = this.add.text(boxX, boxY + 80, '   [ NOT NOW ]', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '15px',
      color: '#8E8AAB',
      fontStyle: 'bold',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.#selectedMissionOption = 1;
        this.#updateMissionPromptUI();
      })
      .on('pointerdown', () => {
        this.#selectedMissionOption = 1;
        this.#executeMissionOption();
      });

    const footerHint = this.add.text(boxX, boxY + 120, '[W/S or ↑/↓] SELECT   [SPACE / ENTER] CONFIRM   [ESC] CANCEL', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#3FF0FF',
    }).setOrigin(0.5);

    this.#missionPromptOptions = [optStart, optCancel];

    this.#missionPromptContainer.add([
      backdrop,
      modalBox,
      cornerDecor,
      this.#missionPromptTitleText,
      this.#missionPromptSubtitleText,
      apeTauntBox,
      this.#missionPromptTauntText,
      optStart,
      optCancel,
      footerHint,
    ]);
  }

  /**
   * Opens confirmation prompt for the given Ape
   * @param {any} ape
   * @returns {void}
   */
  #openMissionConfirmation(ape) {
    if (this.#isMissionPromptOpen || !ape) return;
    if (this.#lastMissionDeclineTime && (this.time.now - this.#lastMissionDeclineTime) < 1000) {
      return;
    }

    this.#isMissionPromptOpen = true;
    this.#activeApeForMission = ape;
    this.#selectedMissionOption = 0; // Default: START MISSION

    if (this.#talkIndicatorContainer) {
      this.#talkIndicatorContainer.setVisible(false);
    }

    if (this.#missionPromptSubtitleText) {
      this.#missionPromptSubtitleText.setText(`${ape.districtName} // ${ape.label}`);
    }

    if (this.#missionPromptTauntText) {
      this.#missionPromptTauntText.setText(`"${ape.taunt}"`);
    }

    this.#updateMissionPromptUI();
    if (this.#missionPromptContainer) {
      this.#missionPromptContainer.setVisible(true);
    }
  }

  /**
   * Refreshes colors/prefixes for the 2 options
   * @returns {void}
   */
  #updateMissionPromptUI() {
    if (!this.#missionPromptOptions || this.#missionPromptOptions.length < 2) return;

    const opt0 = this.#missionPromptOptions[0];
    const opt1 = this.#missionPromptOptions[1];

    if (this.#selectedMissionOption === 0) {
      opt0.setText('▶  [ START MISSION ]').setColor('#00FF66').setScale(1.08);
      opt1.setText('   [ NOT NOW ]').setColor('#8E8AAB').setScale(1.0);
    } else {
      opt0.setText('   [ START MISSION ]').setColor('#8E8AAB').setScale(1.0);
      opt1.setText('▶  [ NOT NOW ]').setColor('#FF3366').setScale(1.08);
    }
  }

  /**
   * Executes the chosen option
   * @returns {void}
   */
  #executeMissionOption() {
    const ape = this.#activeApeForMission;
    const choice = this.#selectedMissionOption;
    this.#closeMissionConfirmation();

    if (choice === 0 && ape) {
      // Start Mission
      this.#triggerApeBattle(ape);
    }
  }

  /**
   * Closes the confirmation prompt and returns control
   * @returns {void}
   */
  #closeMissionConfirmation() {
    this.#isMissionPromptOpen = false;
    this.#activeApeForMission = null;
    this.#lastMissionDeclineTime = this.time ? this.time.now : Date.now();
    if (this.#missionPromptContainer) {
      this.#missionPromptContainer.setVisible(false);
    }
  }

  /**
   * Triggers the battle transition and dialog sequence for a Hacker Ape
   * @param {any} ape
   * @returns {void}
   */
  #triggerApeBattle(ape) {
    if (TimeManager.worldRemainingMs <= 0 || runState.timeRemaining <= 0) {
      this.scene.start(SCENE_KEYS.RESULTS_SCENE);
      return;
    }
    this.#isEngagingPortal = true;
    this._controls.lockInput = true;

    // 1. "!" pops over the ape
    const emote = this.add.container(ape.sprite.x, ape.sprite.y - 48).setDepth(999);
    const bubble = this.add.circle(0, 0, 14, 0x070415, 0.95).setStrokeStyle(2, 0xFFD700);
    const excl = this.add.text(0, 0, '!', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '20px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    emote.add([bubble, excl]);

    this.tweens.add({
      targets: emote,
      y: '-=16',
      scale: { from: 0.6, to: 1.15 },
      duration: 300,
      ease: 'Back.easeOut',
    });

    // 2. Play taunt line in dialog box
    this.time.delayedCall(400, () => {
      this.#dialogUi.showDialogModal([ape.taunt], () => {
        emote.destroy();

        if (ape.game === 'chainHeist' || ape.portalId === 4) {
          this.#openChainHeistOverlay();
        } else {
          // 3. Existing battle transition plays (camera fade)
          this.cameras.main.fadeOut(800, 0, 0, 0);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            // 4. Battle-intro screen in existing battle style
            this.scene.start(SCENE_KEYS.APE_BATTLE_SCENE, {
              mode: 'intro',
              portalId: ape.portalId,
              game: ape.game,
              districtName: ape.districtName,
              apeAsset: ape.assetKey,
              apeName: 'HACKER APE',
            });
          });
        }
      });
    });
  }

  /**
   * Launches CHAIN HEIST (District 4) in a fullscreen iframe overlay with fallback to new tab
   * @returns {void}
   */
  #openChainHeistOverlay() {
    this.#isEngagingPortal = false;
    this._controls.lockInput = true;
    let minigameScore = 0;
    let channel = null;

    // Start TimeManager session for Chain Heist
    const session = TimeManager.beginSession('chainHeist');
    const sessionId = session ? session.sessionId : null;

    // Listen for broadcast events from chain-heist
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('chain_heist_channel');
        channel.onmessage = (ev) => {
          if (ev.data && ev.data.payload && typeof ev.data.payload.score === 'number') {
            minigameScore = Math.max(minigameScore, ev.data.payload.score);
          }
          if (ev.data && ev.data.payload && ev.data.payload.newEntry && typeof ev.data.payload.newEntry.score === 'number') {
            minigameScore = Math.max(minigameScore, ev.data.payload.newEntry.score);
          }
        };
      } catch (err) {
        console.warn('[ChainHeist] BroadcastChannel error:', err);
      }
    }

    const messageListener = (ev) => {
      if (ev.data && ev.data.type === 'CHAIN_HEIST_EVENT' && ev.data.data) {
        const d = ev.data.data;
        if (d.payload && typeof d.payload.score === 'number') {
          minigameScore = Math.max(minigameScore, d.payload.score);
        }
      }
      if (ev.data && typeof ev.data.score === 'number') {
        minigameScore = Math.max(minigameScore, ev.data.score);
      }
    };
    window.addEventListener('message', messageListener);

    // Fullscreen Overlay Container
    const overlay = document.createElement('div');
    overlay.id = 'chain-heist-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.background = '#04020a';

    // Header Bar
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.height = '52px';
    header.style.padding = '0 20px';
    header.style.background = 'rgba(10, 6, 28, 0.96)';
    header.style.borderBottom = '2px solid #00E5FF';
    header.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.4)';
    header.style.color = '#fff';
    header.style.fontFamily = 'monospace';

    const title = document.createElement('div');
    title.innerHTML = '<strong style="color: #00E5FF; font-size: 16px; letter-spacing: 1px;">⛓️‍💥 CHAIN HEIST // DISTRICT 4 SIMULATOR</strong>';

    const status = document.createElement('div');
    status.style.color = '#FFD700';
    status.style.fontSize = '12px';
    status.innerText = 'MISSION ACTIVE · PARTICIPATION BONUS: +500 BIT';

    // Dual Countdown Timers
    const timerDisplay = document.createElement('div');
    timerDisplay.style.display = 'flex';
    timerDisplay.style.gap = '16px';
    timerDisplay.style.fontFamily = 'monospace';
    timerDisplay.style.fontSize = '13px';
    timerDisplay.style.fontWeight = 'bold';

    const minigameTimerSpan = document.createElement('span');
    minigameTimerSpan.style.color = '#00E5FF';
    minigameTimerSpan.innerText = 'TIME: 01:30';

    const worldTimerSpan = document.createElement('span');
    worldTimerSpan.style.color = '#FFD700';
    worldTimerSpan.innerText = `WORLD: ${TimeManager.getFormattedWorldTime()}`;

    timerDisplay.appendChild(minigameTimerSpan);
    timerDisplay.appendChild(worldTimerSpan);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕ RETURN TO NEO-CITY';
    closeBtn.style.padding = '8px 18px';
    closeBtn.style.background = 'rgba(255, 42, 109, 0.15)';
    closeBtn.style.border = '2px solid #FF2A6D';
    closeBtn.style.color = '#FF2A6D';
    closeBtn.style.fontFamily = 'monospace';
    closeBtn.style.fontSize = '13px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.transition = 'all 0.2s';
    closeBtn.onmouseover = () => {
      closeBtn.style.background = '#FF2A6D';
      closeBtn.style.color = '#04020a';
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.background = 'rgba(255, 42, 109, 0.15)';
      closeBtn.style.color = '#FF2A6D';
    };

    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(timerDisplay);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.src = '/chain-heist/index.html';
    iframe.style.flex = '1';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.onerror = () => {
      console.warn('[ChainHeist] Iframe blocked or failed, opening in new tab');
      window.open('/chain-heist/index.html', '_blank');
    };
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    let isClosed = false;
    let lastTickTime = performance.now();

    const timerInterval = setInterval(() => {
      if (isClosed) return;
      const now = performance.now();
      const deltaMs = Math.min(100, Math.max(0, now - lastTickTime));
      lastTickTime = now;

      const timeStatus = TimeManager.tick(deltaMs);
      const readout = TimeManager.getLiveReadout();

      minigameTimerSpan.innerText = `TIME: ${readout.formattedSessionTime}`;
      worldTimerSpan.innerText = `WORLD: ${readout.formattedLiveWorldTime}`;

      if (readout.sessionRemainingSec <= 10) {
        minigameTimerSpan.style.color = '#FF2A6D';
      }
      if (readout.liveWorldRemainingSec <= 60) {
        worldTimerSpan.style.color = '#FF2A6D';
      }

      if (timeStatus.sessionExpired || timeStatus.worldExpired) {
        handleClose(timeStatus.worldExpired ? SESSION_END_REASONS.WORLD_TIME_UP : SESSION_END_REASONS.TIMEOUT);
      }
    }, 100);

    /**
     * @param {string} [reason]
     */
    const handleClose = (reason = SESSION_END_REASONS.OVERLAY_CLOSED) => {
      if (isClosed) return;
      isClosed = true;
      clearInterval(timerInterval);

      if (sessionId) {
        TimeManager.endSession(sessionId, reason);
      }

      if (channel) {
        try { channel.close(); } catch {}
      }
      window.removeEventListener('message', messageListener);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      this._controls.lockInput = false;

      // Award score: if game emitted score, cap at MAX_MINIGAME_SCORE, else PARTICIPATION_BONUS (500)
      const earnedScore = minigameScore > 0 ? Math.min(MAX_MINIGAME_SCORE, minigameScore) : PARTICIPATION_BONUS;
      ScoreManager.reportGameResult('chainHeist', {
        score: earnedScore,
        completed: true,
        portalId: 4,
      });

      runState.timeRemaining = TimeManager.worldRemainingSec;
      this.#updateRunHud(this.time ? this.time.now : 0);

      // Check if world timer expired or all 4 districts are now cleared
      if (TimeManager.worldRemainingMs <= 0 || runState.timeRemaining <= 0) {
        this.scene.start(SCENE_KEYS.RESULTS_SCENE);
        return;
      }

      if (runState.cleared.length >= MAX_DISTRICTS) {
        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start(SCENE_KEYS.RESULTS_SCENE);
        });
      } else {
        this.#dialogUi.showDialogModal([
          `CHAIN HEIST MISSION COMPLETE!`,
          `CONSENSUS TIMELINE RESTORED! +${earnedScore} BIT EARNED!`,
        ]);
      }
    };

    closeBtn.onclick = () => handleClose(SESSION_END_REASONS.PLAYER_QUIT);
  }

  /**
   * Builds the modal pause menu
   * @returns {void}
   */
  #createPauseMenu() {
    const width = 1024;
    const height = 576;

    this.#pauseMenuContainer = this.add.container(0, 0);
    this.#pauseMenuContainer.setScrollFactor(0).setDepth(1000030).setVisible(false);

    // Full screen dim backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x05030e, 0.82)
      .setOrigin(0)
      .setInteractive();

    // Pause Dialog Box
    const boxWidth = 460;
    const boxHeight = 270;
    const boxX = width / 2;
    const boxY = height / 2;

    const modalBox = this.add.rectangle(boxX, boxY, boxWidth, boxHeight, 0x0e0a24, 0.98)
      .setStrokeStyle(2, 0x3FF0FF, 1);

    const cornerDecor = this.add.graphics();
    cornerDecor.lineStyle(2, 0xFF3366, 0.8);
    cornerDecor.strokeRect(boxX - boxWidth / 2 - 4, boxY - boxHeight / 2 - 4, boxWidth + 8, boxHeight + 8);

    const header = this.add.text(boxX, boxY - 85, '// SYSTEM PAUSED //', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '22px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subheader = this.add.text(boxX, boxY - 58, 'CYBER-GRID EXECUTION SUSPENDED', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '12px',
      color: '#8E8AAB',
    }).setOrigin(0.5);

    // Option 0: Resume
    const resumeText = this.add.text(boxX, boxY - 5, '▶ RESUME MISSION', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    resumeText.on('pointerdown', () => {
      this.#selectedPauseOption = 0;
      this.#executePauseOption();
    });

    // Option 1: Quit
    const quitText = this.add.text(boxX, boxY + 42, '▶ QUIT TO TITLE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '18px',
      color: '#777292',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    quitText.on('pointerdown', () => {
      this.#selectedPauseOption = 1;
      this.#executePauseOption();
    });

    const footer = this.add.text(boxX, boxY + 95, '[W/S or ↑/↓] SELECT  •  [SPACE/ENTER] CONFIRM  •  [ESC] RESUME', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#655F82',
    }).setOrigin(0.5);

    this.#pauseOptionTexts = [resumeText, quitText];

    this.#pauseMenuContainer.add([
      backdrop,
      modalBox,
      cornerDecor,
      header,
      subheader,
      resumeText,
      quitText,
      footer,
    ]);
  }

  /**
   * Toggles pause menu state
   * @returns {void}
   */
  #togglePauseMenu() {
    this.#isGamePaused = !this.#isGamePaused;
    if (this.#isGamePaused) {
      this.#selectedPauseOption = 0;
      this.#updatePauseMenuUI();
      this.#pauseMenuContainer.setVisible(true);
      runState.pauseTimer();
    } else {
      this.#pauseMenuContainer.setVisible(false);
      runState.resumeTimer();
    }
  }

  /**
   * Refreshes highlight and styles on pause options
   * @returns {void}
   */
  #updatePauseMenuUI() {
    this.#pauseOptionTexts.forEach((optText, index) => {
      const isSelected = index === this.#selectedPauseOption;
      if (isSelected) {
        optText.setColor(index === 0 ? '#3FF0FF' : '#FF3366').setScale(1.08).setFontStyle('bold');
      } else {
        optText.setColor('#777292').setScale(1).setFontStyle('normal');
      }
    });
  }

  /**
   * Executes the chosen pause action
   * @returns {void}
   */
  #executePauseOption() {
    if (this.#selectedPauseOption === 0) {
      this.#togglePauseMenu();
    } else {
      this.#isGamePaused = false;
      this.#pauseMenuContainer.setVisible(false);
      runState.save();
      this.scene.start(SCENE_KEYS.TITLE_SCENE);
    }
  }

  /**
   * Builds the fixed top-right minimap overlay (~160px wide, cyan neon border, dark frame, portal icons, blinking player dot)
   * @returns {void}
   */
  #createMinimap() {
    const mapWidth = 200;
    const mapHeight = 120;
    const frameX = 808;
    const frameY = 14;

    this.#minimapContainer = this.add.container(frameX, frameY);
    this.#minimapContainer.setScrollFactor(0).setDepth(1000000);

    // Dark frame with cyan neon border
    const darkFrame = this.add.rectangle(-2, -2, mapWidth + 4, mapHeight + 4, 0x050414, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3FF0FF, 0.95);

    // Header label
    const headerBg = this.add.rectangle(-2, -16, 78, 14, 0x070414, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.8);
    const headerLabel = this.add.text(2, -15, 'MAP // 2099', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '9px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    });

    // Scaled copy of neo-city.png
    const mapTextureKey = this.textures.exists('neo-city') ? 'neo-city' : WORLD_ASSET_KEYS.MAIN_1_BACKGROUND;
    const mapImage = this.add.image(0, 0, mapTextureKey)
      .setOrigin(0, 0)
      .setDisplaySize(mapWidth, mapHeight);
    mapImage.setAlpha(0.88);
    if (mapImage.texture) {
      mapImage.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Portal icons container
    const portalsGroup = this.add.container(0, 0);
    this.#minimapPortalMarkers = [];

    this.#portals.forEach((p) => {
      const mx = (p.cx / MAP_WIDTH) * mapWidth;
      const my = (p.cy / MAP_HEIGHT) * mapHeight;
      const isCleared = runState.cleared.includes(p.id);

      const glow = this.add.circle(mx, my, 4.5, isCleared ? 0x00FF66 : 0x00E5FF, 0.35);
      const marker = this.add.circle(mx, my, 3, isCleared ? 0x00FF66 : 0x00E5FF, 1.0);
      marker.setStrokeStyle(1, 0x020108, 0.9);

      portalsGroup.add([glow, marker]);
      this.#minimapPortalMarkers.push({ id: p.id, marker, glow });
    });

    // Blinking player dot
    this.#minimapPlayerDot = this.add.circle(0, 0, 3.5, 0xFFE600, 1.0);
    this.#minimapPlayerDot.setStrokeStyle(1.5, 0xFFFFFF, 1.0);

    this.tweens.add({
      targets: this.#minimapPlayerDot,
      alpha: { from: 1.0, to: 0.15 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Bottom toggle hint
    const hintText = this.add.text(mapWidth, mapHeight + 3, '[M] EXPAND', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '9px',
      color: '#8E8AAB',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    this.#minimapContainer.add([
      darkFrame,
      headerBg,
      headerLabel,
      mapImage,
      portalsGroup,
      this.#minimapPlayerDot,
      hintText,
    ]);
  }

  /**
   * Syncs player position and portal cleared status on minimap
   * @returns {void}
   */
  #updateMinimap() {
    if (!this.#minimapContainer) return;

    // Update portal colors
    this.#minimapPortalMarkers.forEach((item) => {
      const isCleared = runState.cleared.includes(item.id);
      const col = isCleared ? 0x00FF66 : 0x00E5FF;
      item.marker.setFillStyle(col);
      item.glow.setFillStyle(col);
    });

    // Update player dot
    if (this.#player && this.#player.sprite && this.#minimapPlayerDot) {
      const px = this.#player.sprite.x;
      const py = this.#player.sprite.y;
      const mx = Phaser.Math.Clamp((px / MAP_WIDTH) * 200, 2, 198);
      const my = Phaser.Math.Clamp((py / MAP_HEIGHT) * 120, 2, 118);
      this.#minimapPlayerDot.setPosition(mx, my);
    }
  }

  /**
   * Builds the big centered map view overlay (toggled via M key, pauses game)
   * @returns {void}
   */
  #createBigMap() {
    this.#bigMapContainer = this.add.container(0, 0);
    this.#bigMapContainer.setScrollFactor(0).setDepth(1000040);
    this.#bigMapContainer.setVisible(false);

    // Fullscreen dark backdrop
    const backdrop = this.add.rectangle(0, 0, 1024, 576, 0x020108, 0.85)
      .setOrigin(0, 0)
      .setInteractive(); // block pointer events

    // Center dialog frame
    const frameW = 672;
    const frameH = 450;
    const cx = 512;
    const cy = 288;

    const darkPanel = this.add.rectangle(cx, cy, frameW, frameH, 0x070414, 0.97)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2.5, 0x3FF0FF, 1.0);

    const outerGlow = this.add.rectangle(cx, cy, frameW + 6, frameH + 6)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1.5, 0x00E5FF, 0.35);

    // Header banner
    const titleText = this.add.text(cx, cy - 200, 'NEO-CITY 2099 // DISTRICT SURVEILLANCE', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '17px',
      color: '#3FF0FF',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const statusText = this.add.text(cx, cy - 180, `SECURE ALL ${MAX_DISTRICTS} PORTAL DISTRICTS TO OVERRIDE THE BLOCKCHAIN`, {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '11px',
      color: '#8E8AAB',
    }).setOrigin(0.5, 0.5);

    // Scaled map image: 640x384 centered
    const mapW = 640;
    const mapH = 384;
    const mapTextureKey = this.textures.exists('neo-city') ? 'neo-city' : WORLD_ASSET_KEYS.MAIN_1_BACKGROUND;
    const bigMapImage = this.add.image(cx, cy + 6, mapTextureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(mapW, mapH);
    bigMapImage.setAlpha(0.92);
    if (bigMapImage.texture) {
      bigMapImage.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    const mapBorder = this.add.rectangle(cx, cy + 6, mapW + 2, mapH + 2)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1.5, 0x3FF0FF, 0.6);

    // Dynamic contents container (portals & player dot)
    this.#bigMapDynamicLayer = this.add.container(cx - mapW / 2, cy + 6 - mapH / 2);

    // Footer instruction
    const closeHint = this.add.text(cx, cy + 210, '[M] or [ESC] CLOSE MAP', {
      fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
      fontSize: '13px',
      color: '#00E5FF',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.#bigMapContainer.add([
      backdrop,
      darkPanel,
      outerGlow,
      titleText,
      statusText,
      bigMapImage,
      mapBorder,
      this.#bigMapDynamicLayer,
      closeHint,
    ]);
  }

  /**
   * Toggles the big map view on/off (game is paused while open)
   * @returns {void}
   */
  #toggleBigMap() {
    this.#isBigMapOpen = !this.#isBigMapOpen;
    if (this.#isBigMapOpen) {
      this.#rebuildBigMapContent();
      this.#bigMapContainer?.setVisible(true);
      runState.pauseTimer();
    } else {
      this.#bigMapContainer?.setVisible(false);
      runState.resumeTimer();
    }
  }

  /**
   * Rebuilds dynamic markers on the big map view
   * @returns {void}
   */
  #rebuildBigMapContent() {
    if (!this.#bigMapDynamicLayer) return;
    this.#bigMapDynamicLayer.removeAll(true);

    const mapW = 640;
    const mapH = 384;

    // 1. Portal icons on big map
    this.#portals.forEach((p) => {
      const bx = (p.cx / MAP_WIDTH) * mapW;
      const by = (p.cy / MAP_HEIGHT) * mapH;
      const isCleared = runState.cleared.includes(p.id);
      const col = isCleared ? 0x00FF66 : 0x00E5FF;
      const colHex = isCleared ? '#00FF66' : '#3FF0FF';

      // Outer pulsing ring
      const glow = this.add.circle(bx, by, 11, col, 0.28);
      this.tweens.add({
        targets: glow,
        scale: { from: 0.85, to: 1.25 },
        alpha: { from: 0.15, to: 0.45 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Center core
      const core = this.add.circle(bx, by, 6.5, col, 1.0);
      core.setStrokeStyle(1.5, 0x04030a, 1.0);

      // District label with clear status badge
      const labelText = `[${p.id}] ${p.label}`;
      const statusText = isCleared ? '✓ SECURED' : '⚠ HOSTILE APE';

      const tag = this.add.text(bx, by - 20, labelText, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '11px',
        color: colHex,
        fontStyle: 'bold',
        stroke: '#050210',
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5);

      const statusTag = this.add.text(bx, by + 18, statusText, {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '9px',
        color: isCleared ? '#00FF66' : '#FF9900',
        fontStyle: 'bold',
        stroke: '#050210',
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5);

      this.#bigMapDynamicLayer.add([glow, core, tag, statusTag]);
    });

    // 2. Blinking player dot on big map
    if (this.#player && this.#player.sprite) {
      const pwX = this.#player.sprite.x + 32;
      const pwY = this.#player.sprite.y + 32;
      const bpx = Phaser.Math.Clamp((pwX / MAP_WIDTH) * mapW, 6, mapW - 6);
      const bpy = Phaser.Math.Clamp((pwY / MAP_HEIGHT) * mapH, 6, mapH - 6);

      // Expanding radar wave
      const radar = this.add.circle(bpx, bpy, 6, 0xFFE600, 0.5);
      this.tweens.add({
        targets: radar,
        scale: 3,
        alpha: 0,
        duration: 1000,
        repeat: -1,
      });

      // Player dot
      const pDot = this.add.circle(bpx, bpy, 5.5, 0xFFE600, 1.0);
      pDot.setStrokeStyle(1.5, 0xFFFFFF, 1.0);

      this.tweens.add({
        targets: pDot,
        alpha: { from: 1.0, to: 0.2 },
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const youTag = this.add.text(bpx, bpy - 15, 'YOU', {
        fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
        fontSize: '11px',
        color: '#FFE600',
        fontStyle: 'bold',
        stroke: '#050210',
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5);

      this.#bigMapDynamicLayer.add([radar, pDot, youTag]);
    }
  }

  /**
   * Applies neon cyberpunk atmosphere:
   * - Night colour grade (postFX colorMatrix / tint toward dark navy + violet)
   * - Glow postFX on the player
   * - Floating neon particles
   * - Subtle scanline overlay
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createCyberpunkPolish(map) {
    // 1. Night colour grade (Phaser postFX colorMatrix / tint toward dark navy + violet)
    if (this.cameras.main.postFX) {
      const colorMatrix = this.cameras.main.postFX.addColorMatrix();
      colorMatrix.saturate(1.25);
      colorMatrix.contrast(1.08);
    }

    // Single source of tint: background image at depth 0 has bgImage.setTint(0xA698D8)

    // 2. Glow postFX on the player
    if (this.#player?.sprite?.postFX) {
      this.#player.sprite.postFX.addGlow(0x3FF0FF, 2, 0, false, 0.1, 8);
    }

    // 3. Floating neon particles (25 lightweight motes drifting across camera)
    if (!isReduceMotionActive()) {
      if (!this.textures.exists('neon-mote')) {
        const pGfx = this.make.graphics({ x: 0, y: 0 }, false);
        pGfx.fillStyle(0xFFFFFF, 1);
        pGfx.fillCircle(2, 2, 2);
        pGfx.generateTexture('neon-mote', 4, 4);
        pGfx.destroy();
      }

      this.add.particles(0, 0, 'neon-mote', {
        x: { min: 0, max: 1024 },
        y: { min: 0, max: 576 },
        speedX: { min: -10, max: 10 },
        speedY: { min: -18, max: -40 },
        scale: { start: 0.6, end: 1.2 },
        alpha: { start: 0, end: 0.45, ease: 'Sine.easeInOut' },
        lifespan: { min: 2500, max: 4000 },
        tint: [0x3FF0FF, 0xFF3FD0, 0x00FF66, 0xF5B82E],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 200,
        maxAliveParticles: 25,
      }).setScrollFactor(0).setDepth(850);
    }

    // 4. Subtle scanline overlay (depth 890, below HUD/Dialog so text stays 100% crisp)
    if (!this.textures.exists('cyber-scanline')) {
      const scanGfx = this.make.graphics({ x: 0, y: 0 }, false);
      scanGfx.fillStyle(0x000000, 0.22);
      scanGfx.fillRect(0, 0, 1024, 2);
      scanGfx.fillStyle(0x000000, 0.0);
      scanGfx.fillRect(0, 2, 1024, 2);
      scanGfx.generateTexture('cyber-scanline', 1024, 4);
      scanGfx.destroy();
    }

    this.add.tileSprite(0, 0, 1024, 576, 'cyber-scanline')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(890)
      .setAlpha(0.28);
  }

  /**
   * @returns {void}
   */
  #handlePlayerInteraction() {
    if (this.#dialogUi.isAnimationPlaying) {
      return;
    }

    if (this.#dialogUi.isVisible && !this.#dialogUi.moreMessagesToShow) {
      this.#dialogUi.hideDialogModal();
      if (this.#currentCutSceneId !== undefined) {
        this.#isProcessingCutSceneEvent = false;
        this.#handleCutSceneInteraction();
      }
      if (this.#npcPlayerIsInteractingWith) {
        this.#handleNpcInteraction();
      }
      return;
    }

    if (this.#dialogUi.isVisible && this.#dialogUi.moreMessagesToShow) {
      this.#dialogUi.showNextMessage();
      return;
    }

    const px = this.#player.sprite.x;
    const py = this.#player.sprite.y;

    // 1. Check for nearby Hacker Ape within interaction radius -> open confirmation prompt
    const nearbyApe = this.#hackerApes.find((ape) => {
      if (runState.cleared.includes(ape.portalId)) return false;
      const dist = Phaser.Math.Distance.Between(px, py, ape.sprite.x, ape.sprite.y);
      return dist <= (ape.interactionRadius || NPC_INTERACTION_RADIUS);
    });
    if (nearbyApe) {
      const now = this.time ? this.time.now : Date.now();
      if (this.#lastMissionDeclineTime && (now - this.#lastMissionDeclineTime) < 1000) {
        return;
      }
      this.#openMissionConfirmation(nearbyApe);
      return;
    }

    // get players current direction and check target position
    const { x, y } = this.#player.sprite;
    const targetPosition = getTargetPositionFromGameObjectPositionAndDirection({ x, y }, this.#player.direction);

    // 2. check for sign
    const nearbySign = this.#signLayer?.objects.find((object) => {
      if (!object.x || !object.y) {
        return false;
      }
      const dist = Phaser.Math.Distance.Between(px, py, object.x, object.y - TILE_SIZE);
      return dist < 48 || (object.x === targetPosition.x && object.y - TILE_SIZE === targetPosition.y);
    });

    if (nearbySign) {
      /** @type {import('../types/typedef.js').TiledObjectProperty[]} */
      const props = nearbySign.properties;
      /** @type {number} */
      const signId = props.find((prop) => prop.name === TILED_SIGN_PROPERTY.ID)?.value;
      const sign = DataUtils.getSignData(this, signId);

      const usePlaceholderText = this.#player.direction !== DIRECTION.UP;
      let textToShow = CANNOT_READ_SIGN_TEXT;
      if (!usePlaceholderText) {
        textToShow = sign?.message || SAMPLE_TEXT;
      }
      this.#dialogUi.showDialogModal([textToShow]);
      return;
    }

    // 3. check for nearby regular NPC
    const nearbyNpc = this.#npcs.find((npc) => {
      const dist = Phaser.Math.Distance.Between(px, py, npc.sprite.x, npc.sprite.y);
      return dist < 36 || (npc.sprite.x === targetPosition.x && npc.sprite.y === targetPosition.y);
    });
    if (nearbyNpc) {
      nearbyNpc.facePlayer(this.#player.direction);
      nearbyNpc.isTalkingToPlayer = true;
      this.#npcPlayerIsInteractingWith = nearbyNpc;
      this.#handleNpcInteraction();
      return;
    }

    // 4. check for a nearby item and display message about player finding the item
    let nearbyItemIndex;
    const nearbyItem = this.#items.find((item, index) => {
      const dist = Phaser.Math.Distance.Between(px, py, item.position.x, item.position.y);
      if (dist < 48 || (item.position.x === targetPosition.x && item.position.y === targetPosition.y)) {
        nearbyItemIndex = index;
        return true;
      }
      return false;
    });
    if (nearbyItem) {
      // add item to inventory and display message to player
      const item = DataUtils.getItem(this, nearbyItem.itemId);
      dataManager.addItem(item, 1);
      nearbyItem.gameObject.destroy();
      this.#items.splice(nearbyItemIndex, 1);
      dataManager.addItemPickedUp(nearbyItem.id);
      this.#dialogUi.showDialogModal([`You found a ${item.name}`]);
      return;
    }

    // check for a nearby hidden token
    const nearbyToken = this.#tokens.find(
      (token) => !this.#collectedTokenIds.has(token.id) &&
        (Phaser.Math.Distance.Between(px, py, token.centerX, token.centerY) < 48 ||
         (token.tileX === targetPosition.x && token.tileY === targetPosition.y))
    );
    if (nearbyToken) {
      this.#collectToken(nearbyToken);
      return;
    }
  }

  /**
   * @returns {void}
   */
  #handlePlayerMovementUpdate() {
    this.#updateGuideTrail();

    // update player position on global data store
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION, {
      x: this.#player.sprite.x,
      y: this.#player.sprite.y,
    });

    // update camera bounds for given level after player moves
    CameraUtils.updateMainCameraBounds(this, this.#player.sprite, this.#cameraRegions);

    // check to see if the player encountered cut scene zone
    this.#player.sprite.getBounds(this.#rectangleForOverlapCheck1);
    for (const zone of Object.values(this.#eventZones)) {
      // get the bounds of the player and zone for checking for overlap
      zone.getBounds(this.#rectangleForOverlapCheck2);

      // reset rectangle overlap size, needed since method below will
      // return the original rectangle unmodified if a previous match
      // was found.
      this.#rectangleOverlapResult.setSize(0, 0);
      Phaser.Geom.Intersects.GetRectangleIntersection(
        this.#rectangleForOverlapCheck1,
        this.#rectangleForOverlapCheck2,
        this.#rectangleOverlapResult
      );

      if (ENABLE_ZONE_DEBUGGING) {
        // for debugging the overlap checks for the events
        this.#gfx.clear();
        this.#gfx.strokeRectShape(this.#rectangleOverlapResult);
      }

      const isOverlapping =
        this.#rectangleOverlapResult.width >= TILE_SIZE - 10 && this.#rectangleOverlapResult.height >= TILE_SIZE - 10;

      if (isOverlapping) {
        const eventId = parseInt(zone.name, 10);
        const eventData = DataUtils.getEventData(this, eventId);
        const currentGameFlags = dataManager.getFlags();
        const eventRequirementsMet = eventData.requires.every((flag) => {
          return currentGameFlags.has(flag);
        });
        if (eventRequirementsMet) {
          this.#currentCutSceneId = parseInt(zone.name, 10);
          this.#startCutScene();
          break;
        }
      }
    }
    if (this.#currentCutSceneId !== undefined) {
      return;
    }
    if (this.#encounterLayers.length === 0) {
      return;
    }
    this.#handlePlayerMovementInEncounterZone();
  }

  /**
   * @returns {void}
   */
  #handlePlayerMovementInEncounterZone() {
    // cleanup any special tiles that are not at the players current position
    this.#specialEncounterTileImageGameObjectGroup
      .getChildren()
      .forEach((rawChild) => {
        const child = /** @type {Phaser.GameObjects.Image} */ (rawChild);
        if (!child.active) {
          return;
        }
        if (child.x === this.#player.sprite.x && child.y === this.#player.sprite.y) {
          child.visible = true;
          return;
        }
        child.active = false;
        child.visible = false;
      });
    if (this.#encounterZonePlayerIsEntering === undefined) {
      return;
    }
    console.log(`[${WorldScene.name}:handlePlayerMovementInEncounterZone] player is in an encounter zone`);

    this.#wildMonsterEncountered = Math.random() < 0.2;
    if (this.#wildMonsterEncountered) {
      const encounterAreaId = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (
        this.#encounterZonePlayerIsEntering.layer.properties
      ).find((property) => property.name === TILED_ENCOUNTER_PROPERTY.AREA).value;
      const possibleMonsters = DataUtils.getEncounterAreaDetails(this, encounterAreaId);
      const randomMonsterId = weightedRandom(possibleMonsters);

      console.log(
        `[${WorldScene.name}:handlePlayerMovementUpdate] player encountered a wild monster in area ${encounterAreaId} and monster id has been picked randomly ${randomMonsterId}`
      );
      /** @type {import('./battle-scene.js').BattleSceneData} */
      const dataToPass = {
        enemyMonsters: [DataUtils.getMonsterById(this, randomMonsterId)],
        playerMonsters: dataManager.store.get(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY),
      };
      this.#startBattleScene(dataToPass);
    }
  }

  /**
   * @returns {boolean}
   */
  #isPlayerInputLocked() {
    return (
      this._controls.isInputLocked ||
      this.#dialogUi.isVisible ||
      this.#menu.isVisible ||
      this.#isProcessingNpcEvent ||
      this.#currentCutSceneId !== undefined
    );
  }

  /**
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createNPCs(map) {
    this.#npcs = [];

    const npcLayers = map.getObjectLayerNames().filter((layerName) => layerName.includes('NPC'));
    npcLayers.forEach((layerName) => {
      const layer = map.getObjectLayer(layerName);
      const npcObject = layer.objects.find((obj) => {
        return obj.type === CUSTOM_TILED_TYPES.NPC;
      });
      if (!npcObject || npcObject.x === undefined || npcObject.y === undefined) {
        return;
      }

      // get the path objects for this npc
      const pathObjects = layer.objects.filter((obj) => {
        return obj.type === CUSTOM_TILED_TYPES.NPC_PATH;
      });
      /** @type {import('../world/characters/npc.js').NPCPath} */
      const npcPath = {
        0: { x: npcObject.x, y: npcObject.y - TILE_SIZE },
      };
      pathObjects.forEach((obj) => {
        if (obj.x === undefined || obj.y === undefined) {
          return;
        }
        npcPath[parseInt(obj.name, 10)] = { x: obj.x, y: obj.y - TILE_SIZE };
      });

      /** @type {import('../world/characters/npc.js').NpcMovementPattern} */
      const npcMovement =
        /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (npcObject.properties).find(
          (property) => property.name === TILED_NPC_PROPERTY.MOVEMENT_PATTERN
        )?.value || 'IDLE';

      /** @type {number} */
      const npcId = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (npcObject.properties).find(
        (property) => property.name === TILED_NPC_PROPERTY.ID
      )?.value;
      const npcDetails = DataUtils.getNpcData(this, npcId);
      if (!npcDetails) {
        return;
      }

      // In Tiled, the x value is how far the object starts from the left, and the y is the bottom of tiled object that is being added
      const rawNpcX = npcObject.x;
      const rawNpcY = npcObject.y - TILE_SIZE;
      const reachableNpc = findNearestReachable(rawNpcX, rawNpcY, `NPC #${npcId || 1}`);
      const npc = new NPC({
        scene: this,
        position: { x: reachableNpc.x, y: reachableNpc.y },
        direction: DIRECTION.DOWN,
        frame: npcDetails.frame,
        npcPath,
        movementPattern: npcMovement,
        events: npcDetails.events,
        animationKeyPrefix: npcDetails.animationKeyPrefix,
        id: npcId,
      });
      this.#npcs.push(npc);
    });
  }

  /**
   * @returns {void}
   */
  #handlePlayerDirectionUpdate() {
    // update player direction on global data store
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_DIRECTION, this.#player.direction);
  }

  /**
   * @returns {void}
   */
  #healPlayerParty() {
    // heal all monsters in party
    /** @type {import('../types/typedef.js').Monster[]} */
    const monsters = dataManager.store.get(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY);
    monsters.forEach((monster) => {
      monster.currentHp = monster.maxHp;
    });
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY, monsters);
  }

  /**
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createItems(map) {
    const itemObjectLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.ITEM);
    if (!itemObjectLayer) {
      return;
    }
    const items = itemObjectLayer.objects;
    const validItems = items.filter((item) => {
      return item.x !== undefined && item.y !== undefined;
    });

    /** @type {number[]} */
    const itemsPickedUp = dataManager.store.get(DATA_MANAGER_STORE_KEYS.ITEMS_PICKED_UP) || [];

    for (const tiledItem of validItems) {
      /** @type {number} */
      const itemId = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (tiledItem.properties).find(
        (property) => property.name === TILED_ITEM_PROPERTY.ITEM_ID
      )?.value;

      /** @type {number} */
      const id = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (tiledItem.properties).find(
        (property) => property.name === TILED_ITEM_PROPERTY.ID
      )?.value;

      if (itemsPickedUp.includes(id)) {
        continue;
      }

      // create object
      const item = new Item({
        scene: this,
        position: {
          x: tiledItem.x,
          y: tiledItem.y - TILE_SIZE,
        },
        itemId,
        id,
      });
      this.#items.push(item);
    }
  }

  /**
   * @param {string} entranceName
   * @param {string} entranceId
   * @param {boolean} isBuildingEntrance
   * @returns {void}
   */
  #handleEntranceEnteredCallback(entranceName, entranceId, isBuildingEntrance) {
    this._controls.lockInput = true;

    // update player position to match the new entrance data
    // create tilemap using the provided entrance data
    const map = this.#getLevelTileMap(`${entranceName.toUpperCase()}_LEVEL`);
    // get the position of the entrance object using the entrance id
    const entranceObjectLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.SCENE_TRANSITIONS);
    const entranceObject = entranceObjectLayer.objects.find((object) => {
      const tempEntranceName = object.properties.find((property) => property.name === 'connects_to').value;
      const tempEntranceId = object.properties.find((property) => property.name === 'entrance_id').value;

      return tempEntranceName === this.#sceneData.area && tempEntranceId === entranceId;
    });
    // create position player will be placed at and update based on players facing direction
    let x = entranceObject.x;
    let y = entranceObject.y - TILE_SIZE;
    if (this.#player.direction === DIRECTION.UP) {
      y -= TILE_SIZE;
    }
    if (this.#player.direction === DIRECTION.DOWN) {
      y += TILE_SIZE;
    }

    this.cameras.main.fadeOut(1000, 0, 0, 0, (camera, progress) => {
      if (progress === 1) {
        dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION, {
          x,
          y,
        });

        /** @type {WorldSceneData} */
        const dataToPass = {
          area: entranceName,
          isInterior: isBuildingEntrance,
        };
        this.scene.start(SCENE_KEYS.WORLD_SCENE, dataToPass);
      }
    });
  }

  /**
   * @returns {void}
   */
  #handleNpcInteraction() {
    if (this.#isProcessingNpcEvent) {
      return;
    }

    // check to see if the npc has any events associated with them
    const isMoreEventsToProcess = this.#npcPlayerIsInteractingWith.events.length - 1 !== this.#lastNpcEventHandledIndex;

    if (!isMoreEventsToProcess) {
      this.#npcPlayerIsInteractingWith.isTalkingToPlayer = false;
      this.#npcPlayerIsInteractingWith = undefined;
      this.#lastNpcEventHandledIndex = -1;
      this.#isProcessingNpcEvent = false;
      return;
    }

    // get the next event from the queue and process for this npc
    this.#lastNpcEventHandledIndex += 1;
    const eventToHandle = this.#npcPlayerIsInteractingWith.events[this.#lastNpcEventHandledIndex];
    const eventType = eventToHandle.type;

    // check to see if this event should be handled based on story flags
    const currentGameFlags = dataManager.getFlags();
    const eventRequirementsMet = eventToHandle.requires.every((flag) => {
      if (flag === BATTLE_FLAG.TRAINER_DEFEATED) {
        return dataManager.getDefeatedNpcs().has(this.#npcPlayerIsInteractingWith.id);
      }
      if (flag === BATTLE_FLAG.TRAINER_NOT_DEFEATED) {
        return !dataManager.getDefeatedNpcs().has(this.#npcPlayerIsInteractingWith.id);
      }

      return currentGameFlags.has(flag);
    });
    if (!eventRequirementsMet) {
      // jump to next event
      this.#handleNpcInteraction();
      return;
    }

    switch (eventType) {
      case NPC_EVENT_TYPE.MESSAGE:
        this.#dialogUi.showDialogModal(eventToHandle.data.messages);
        break;
      case NPC_EVENT_TYPE.HEAL:
        this.#isProcessingNpcEvent = true;
        this.#healPlayerParty();
        this.#isProcessingNpcEvent = false;
        this.#handleNpcInteraction();
        break;
      case NPC_EVENT_TYPE.SCENE_FADE_IN_AND_OUT:
        this.#isProcessingNpcEvent = true;
        // lock input, and wait for scene to fade in and out
        this.cameras.main.fadeOut(eventToHandle.data.fadeOutDuration, 0, 0, 0, (fadeOutCamera, fadeOutProgress) => {
          if (fadeOutProgress !== 1) {
            return;
          }
          this.time.delayedCall(eventToHandle.data.waitDuration, () => {
            this.cameras.main.fadeIn(eventToHandle.data.fadeInDuration, 0, 0, 0, (fadeInCamera, fadeInProgress) => {
              if (fadeInProgress !== 1) {
                return;
              }
              this.#isProcessingNpcEvent = false;
              this.#handleNpcInteraction();
            });
          });
        });
        // TODO:future play audio cue
        break;
      case NPC_EVENT_TYPE.BATTLE:
        this.#isProcessingNpcEvent = true;

        // Get monster data from the event
        const npcMonsters = eventToHandle.data.monsters.map((monsterId) => {
          return DataUtils.getMonsterById(this, monsterId);
        });
        /** @type {import('./battle-scene.js').BattleSceneData} */
        const dataToPass = {
          enemyMonsters: npcMonsters,
          playerMonsters: dataManager.store.get(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY),
          isTrainerBattle: true,
          npc: {
            id: this.#npcPlayerIsInteractingWith.id,
            assetKey: eventToHandle.data.assetKey,
            name: eventToHandle.data.trainerName,
            trainerLostMessages: eventToHandle.data.trainerLostMessages,
          },
        };
        this.#startBattleScene(dataToPass);
        break;
      default:
        exhaustiveGuard(eventType);
    }
  }

  /**
   * Creates the Phaser Zone game objects based on the `Events` tilemap data from the Tiled Map.
   * These game objects are used for creating the various in game events and cut scenes for the game.
   * The Zone game objects allow for us to check for overlaps between the player and the area that
   * is defined in the map data.
   *
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createEventEncounterZones(map) {
    const eventObjectLayer = map.getObjectLayer(OBJECT_LAYER_NAMES.EVENTS);
    if (!eventObjectLayer) {
      return;
    }
    const events = eventObjectLayer.objects;
    const validEvents = events.filter((event) => {
      return event.x !== undefined && event.y !== undefined;
    });

    /** @type {string[]} */
    const viewedEvents = dataManager.store.get(DATA_MANAGER_STORE_KEYS.VIEWED_EVENTS);

    for (const tiledEvent of validEvents) {
      /** @type {string} */
      const eventId = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (tiledEvent.properties).find(
        (property) => property.name === TILED_EVENT_PROPERTY.ID
      )?.value;

      if (viewedEvents.includes(eventId)) {
        continue;
      }

      const eventZone = this.add
        .zone(tiledEvent.x, tiledEvent.y - TILE_SIZE * 2, tiledEvent.width, tiledEvent.height)
        .setOrigin(0)
        .setName(eventId);
      this.#eventZones[eventId] = eventZone;

      if (ENABLE_ZONE_DEBUGGING) {
        const debugZoneRectangle = this.add
          .rectangle(eventZone.x, eventZone.y, eventZone.width, eventZone.height, 0xff0000, 0.5)
          .setOrigin(0);
        this.#debugEventZoneObjects[eventId] = debugZoneRectangle;
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async #startCutScene() {
    this.#isProcessingCutSceneEvent = true;
    await /** @type {CutsceneScene} */ (this.scene.get(SCENE_KEYS.CUTSCENE_SCENE)).startCutScene();
    await sleep(500, this);
    this.#isProcessingCutSceneEvent = false;
    this.#handleCutSceneInteraction();
  }

  /**
   * @returns {Promise<void>}
   */
  async #handleCutSceneInteraction() {
    if (this.#isProcessingCutSceneEvent) {
      return;
    }
    if (this.#currentCutSceneId === undefined) {
      return;
    }

    const eventsToProcess = DataUtils.getEventData(this, this.#currentCutSceneId);

    // check to see if the cut scene has any more events to be processed
    const isMoreEventsToProcess = eventsToProcess.events.length - 1 !== this.#lastCutSceneEventHandledIndex;
    if (!isMoreEventsToProcess) {
      // once we are done processing the events for the cutscene, we need to do the following:
      //   1. update our data manager to show we watched the event
      //   2. cleanup zone game object used for the event and overlap detection
      //   3. reset our current cut scene property
      //   4. remove the cut scene bars from the scene
      this.#lastCutSceneEventHandledIndex = -1;
      this.#isProcessingCutSceneEvent = false;
      dataManager.viewedEvent(this.#currentCutSceneId);
      this.#eventZones[this.#currentCutSceneId].destroy();
      delete this.#eventZones[this.#currentCutSceneId];
      if (ENABLE_ZONE_DEBUGGING) {
        this.#gfx.clear();
        this.#debugEventZoneObjects[this.#currentCutSceneId].destroy();
        delete this.#debugEventZoneObjects[this.#currentCutSceneId];
      }
      this.#currentCutSceneId = undefined;

      await /** @type {CutsceneScene} */ (this.scene.get(SCENE_KEYS.CUTSCENE_SCENE)).endCutScene();
      await sleep(500, this);
      return;
    }

    // get the next event from the queue and process for this npc
    this.#lastCutSceneEventHandledIndex += 1;
    const eventToHandle = eventsToProcess.events[this.#lastCutSceneEventHandledIndex];
    const eventType = eventToHandle.type;

    this.#isProcessingCutSceneEvent = true;
    switch (eventType) {
      case GAME_EVENT_TYPE.ADD_NPC:
        this.#createNpcForCutScene(eventToHandle);
        break;
      case GAME_EVENT_TYPE.MOVE_TO_PLAYER:
        this.#moveNpcToPlayer(eventToHandle);
        break;
      case GAME_EVENT_TYPE.RETRACE_PATH:
        this.#haveNpcRetracePath(eventToHandle);
        break;
      case GAME_EVENT_TYPE.REMOVE_NPC:
        this.#removeNpcForCutScene(eventToHandle);
        break;
      case GAME_EVENT_TYPE.TALK_TO_PLAYER:
        this.#haveNpcTalkToPlayer(eventToHandle);
        break;
      case GAME_EVENT_TYPE.GIVE_MONSTER:
        this.#addMonsterFromNpc(eventToHandle);
        break;
      case GAME_EVENT_TYPE.ADD_FLAG:
        this.#addGameFlag(eventToHandle);
        break;
      case GAME_EVENT_TYPE.REMOVE_FLAG:
        this.#removeGameFlag(eventToHandle);
        break;
      default:
        exhaustiveGuard(eventType);
    }
  }

  /**
   * @param {import('../types/typedef.js').GameEventAddNpc} gameEvent
   * @returns {void}
   */
  #createNpcForCutScene(gameEvent) {
    const npc = new NPC({
      scene: this,
      position: { x: gameEvent.data.x * TILE_SIZE, y: gameEvent.data.y * TILE_SIZE },
      direction: gameEvent.data.direction,
      frame: gameEvent.data.frame,
      npcPath: {
        0: { x: gameEvent.data.x * TILE_SIZE, y: gameEvent.data.y * TILE_SIZE },
      },
      movementPattern: NPC_MOVEMENT_PATTERN.IDLE,
      events: [],
      animationKeyPrefix: gameEvent.data.animationKeyPrefix,
      id: gameEvent.data.id,
    });
    this.#npcs.push(npc);
    npc.addCharacterToCheckForCollisionsWith(this.#player);

    this.#isProcessingCutSceneEvent = false;
    this.#handleCutSceneInteraction();
  }

  /**
   * @param {import('../types/typedef.js').GameEventMoveToPlayer} gameEvent
   * @returns {void}
   */
  #moveNpcToPlayer(gameEvent) {
    const targetNpc = this.#npcs.find((npc) => npc.id === gameEvent.data.id);
    if (targetNpc === undefined) {
      this.#isProcessingCutSceneEvent = false;
      this.#handleCutSceneInteraction();
      return;
    }

    // determine direction to move based on distance from player
    const targetPath = getTargetPathToGameObject(targetNpc.sprite, this.#player.sprite);
    const pathToFollow = targetPath.pathToFollow.splice(0, targetPath.pathToFollow.length - 1);

    // if npc is already next to player, just update directions
    if (pathToFollow.length === 0) {
      this.#player.moveCharacter(getTargetDirectionFromGameObjectPosition(this.#player.sprite, targetNpc.sprite));
      targetNpc.facePlayer(this.#player.direction);
      this.#isProcessingCutSceneEvent = false;
      this.#handleCutSceneInteraction();
      return;
    }

    // move npc according to the path
    /** @type {import('../world/characters/npc.js').NPCPath} */
    const npcPath = {
      0: { x: targetNpc.sprite.x, y: targetNpc.sprite.y },
    };
    pathToFollow.forEach((coordinate, index) => {
      npcPath[index + 1] = coordinate;
    });

    targetNpc.finishedMovementCallback = () => {
      if (
        pathToFollow[pathToFollow.length - 1].x === targetNpc.sprite.x &&
        pathToFollow[pathToFollow.length - 1].y === targetNpc.sprite.y
      ) {
        this.#player.moveCharacter(getTargetDirectionFromGameObjectPosition(this.#player.sprite, targetNpc.sprite));
        targetNpc.facePlayer(this.#player.direction);
        this.time.delayedCall(500, () => {
          this.#isProcessingCutSceneEvent = false;
          this.#handleCutSceneInteraction();
        });
      }
    };
    targetNpc.npcMovementPattern = NPC_MOVEMENT_PATTERN.SET_PATH;
    targetNpc.npcPath = npcPath;
    targetNpc.resetMovementTime();
  }

  /**
   * @param {import('../types/typedef.js').GameEventRetracePath} gameEvent
   * @returns {void}
   */
  #haveNpcRetracePath(gameEvent) {
    const targetNpc = this.#npcs.find((npc) => npc.id === gameEvent.data.id);
    if (targetNpc === undefined) {
      this.#isProcessingCutSceneEvent = false;
      this.#handleCutSceneInteraction();
      return;
    }

    // have npc retrace their steps by reversing the existing npc path
    /** @type {import('../world/characters/npc.js').NPCPath} */
    const updatedPath = {};
    const pathKeys = Object.keys(targetNpc.npcPath).reverse();

    pathKeys.forEach((pathKey, index) => {
      updatedPath[index] = targetNpc.npcPath[pathKey];
    });

    // if npc is already next to player, there will be only 1 position in the npc path
    // when this happens, we need to just updates the npcs direction
    if (pathKeys.length === 1) {
      targetNpc.facePlayer(gameEvent.data.direction);
      this.time.delayedCall(500, () => {
        this.#isProcessingCutSceneEvent = false;
        this.#handleCutSceneInteraction();
      });
      return;
    }

    targetNpc.finishedMovementCallback = () => {
      if (
        updatedPath[pathKeys.length - 1].x === targetNpc.sprite.x &&
        updatedPath[pathKeys.length - 1].y === targetNpc.sprite.y
      ) {
        this.time.delayedCall(500, () => {
          this.#isProcessingCutSceneEvent = false;
          this.#handleCutSceneInteraction();
        });
      }
    };

    targetNpc.npcMovementPattern = NPC_MOVEMENT_PATTERN.SET_PATH;
    targetNpc.npcPath = updatedPath;
    targetNpc.resetMovementTime();
  }

  /**
   * @param {import('../types/typedef.js').GameEventRemoveNpc} gameEvent
   * @returns {void}
   */
  #removeNpcForCutScene(gameEvent) {
    // once we are done with an npc for a cutscene, we can remove that npc
    // from our npc array and then start the cleanup process of destroying the game object
    const npcToRemoveIndex = this.#npcs.findIndex((npc) => npc.id === gameEvent.data.id);
    /** @type {NPC | undefined} */
    let npcToRemove;
    if (npcToRemoveIndex !== -1) {
      npcToRemove = this.#npcs.splice(npcToRemoveIndex)[0];
    }
    this.time.delayedCall(100, () => {
      if (npcToRemove !== undefined) {
        npcToRemove.sprite.destroy();
      }
      this.#isProcessingCutSceneEvent = false;
      this.#handleCutSceneInteraction();
    });
  }

  /**
   * @param {import('../types/typedef.js').GameEventTalkToPlayer} gameEvent
   * @returns {void}
   */
  #haveNpcTalkToPlayer(gameEvent) {
    const targetNpc = this.#npcs.find((npc) => npc.id === gameEvent.data.id);
    if (targetNpc === undefined) {
      this.#isProcessingCutSceneEvent = false;
      this.#handleCutSceneInteraction();
      return;
    }

    targetNpc.isTalkingToPlayer = true;
    this.#npcPlayerIsInteractingWith = targetNpc;
    this.#dialogUi.showDialogModal(gameEvent.data.messages);
  }

  /**
   * @param {import('../types/typedef.js').GameEventGiveMonster} gameEvent
   * @returns {void}
   */
  #addMonsterFromNpc(gameEvent) {
    // TODO: add check to see if party is full and do something with 7th monster that is being added
    /** @type {import('../types/typedef.js').Monster[]} */
    const monstersInParty = dataManager.store.get(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY);
    const newMonster = DataUtils.getMonsterById(this, gameEvent.data.id);
    monstersInParty.push(newMonster);
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY, monstersInParty);
    this.#isProcessingCutSceneEvent = false;
    this.#handleCutSceneInteraction();
  }

  /**
   * @param {import('../types/typedef.js').GameEventAddFlag} gameEvent
   * @returns {void}
   */
  #addGameFlag(gameEvent) {
    dataManager.addFlag(gameEvent.data.flag);
    this.#isProcessingCutSceneEvent = false;
    this.#handleCutSceneInteraction();
  }

  /**
   * @param {import('../types/typedef.js').GameEventRemoveFlag} gameEvent
   * @returns {void}
   */
  #removeGameFlag(gameEvent) {
    dataManager.removeFlag(gameEvent.data.flag);
    this.#isProcessingCutSceneEvent = false;
    this.#handleCutSceneInteraction();
  }

  /**
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createEncounterAreas(map) {
    const encounterLayers = map.getTileLayerNames().filter((layerName) => layerName.includes('Encounter'));
    if (encounterLayers.length > 0) {
      const encounterTiles = map.addTilesetImage('encounter', WORLD_ASSET_KEYS.WORLD_ENCOUNTER_ZONE);
      if (!encounterTiles) {
        console.log(
          `[${WorldScene.name}:createEncounterAreas] encountered error while creating encounter tiles from tiled`
        );
        return;
      }

      encounterLayers.forEach((layerName) => {
        const layer = map.createLayer(layerName, encounterTiles, 0, 0);
        layer.setAlpha(TILED_COLLISION_LAYER_ALPHA).setDepth(2);
        this.#encounterLayers.push(layer);
      });
    }
  }

  /**
   * This method is invoked any time the player is about to start moving between grid spaces.
   * Before the player moves, check to see they will be moving into an encounter zone, and store the result.
   * We will use this result after the player finishes moving to see if there should be an encounter.
   * @param {import('../types/typedef.js').Coordinate} position
   * @returns {void}
   */
  #handlePlayerMovementStarted(position) {
    this.#encounterZonePlayerIsEntering = undefined;

    /** @type {Phaser.Tilemaps.Tile} */
    let encounterTile;
    this.#encounterLayers.some((encounterLayer) => {
      encounterTile = encounterLayer.getTileAtWorldXY(position.x, position.y, true);
      if (encounterTile === null || encounterTile.index === -1) {
        return false;
      }
      this.#encounterZonePlayerIsEntering = encounterLayer;
      return true;
    });

    if (this.#encounterZonePlayerIsEntering === undefined) {
      if (this.#player.direction === DIRECTION.DOWN) {
        // if player is moving in the down direction, hide current tile so player does not move under it
        this.#hideSpecialEncounterTiles();
      }
      return;
    }

    console.log(`[${WorldScene.name}:handlePlayerMovementStarted] player is moving to an encounter zone`);
    // check the tile type for the encounter layer the player is moving through and play related effects
    this.#handleEncounterTileTypeEffects(this.#encounterZonePlayerIsEntering, encounterTile, this.#player.direction);
  }

  /**
   * Plays the associated special effects when player is about to move through a particular tile type.
   * Example, when moving through the grass, we play a sound effect and show an additional
   * game object to make it look like the player is moving through the grass.
   *
   * @param {Phaser.Tilemaps.TilemapLayer} encounterLayer
   * @param {Phaser.Tilemaps.Tile} encounterTile
   * @param {import('../common/direction.js').Direction} playerDirection
   * @returns {void}
   */
  #handleEncounterTileTypeEffects(encounterLayer, encounterTile, playerDirection) {
    // check the tile type for the encounter layer the player is moving through and play related effects
    /** @type {import('../types/typedef.js').EncounterTileType} */
    const encounterTileType = /** @type {import('../types/typedef.js').TiledObjectProperty[]} */ (
      encounterLayer.layer.properties
    ).find((property) => property.name === TILED_ENCOUNTER_PROPERTY.TILE_TYPE).value;

    switch (encounterTileType) {
      case ENCOUNTER_TILE_TYPE.GRASS:
        // create grass sprite for when player moves through grass
        /** @type {Phaser.GameObjects.Image} */
        const object = this.#specialEncounterTileImageGameObjectGroup
          .getFirstDead(true, encounterTile.pixelX, encounterTile.pixelY, WORLD_ASSET_KEYS.GRASS, 1, true)
          .setOrigin(0)
          .setVisible(true)
          .setActive(true);
        // if player is moving up or down, don't show grass so they don't appear to be moving under it, will show after they reach the destination
        if (playerDirection === DIRECTION.DOWN || playerDirection === DIRECTION.UP) {
          object.visible = false;
        }
        playSoundFx(this, AUDIO_ASSET_KEYS.GRASS);
        break;
      case ENCOUNTER_TILE_TYPE.NONE:
        break;
      default:
        exhaustiveGuard(encounterTileType);
    }

    if (playerDirection !== DIRECTION.DOWN) {
      return;
    }

    // if player is moving in the down direction, hide current tile so player does not move under it
    this.#hideSpecialEncounterTiles();
  }

  /**
   * @returns {void}
   */
  #hideSpecialEncounterTiles() {
    this.#specialEncounterTileImageGameObjectGroup
      .getChildren()
      .some((rawChild) => {
        const child = /** @type {Phaser.GameObjects.Image} */ (rawChild);
        if (!child.active) {
          return false;
        }
        if (child.x === this.#player.sprite.x && child.y === this.#player.sprite.y) {
          child.active = false;
          child.visible = false;
          return true;
        }
        return false;
      });
  }

  /**
   * @param {string} key
   * @returns {Phaser.Tilemaps.Tilemap}
   */
  #getLevelTileMap(key) {
    if (this.#tiledLevelMaps[key]) {
      return this.#tiledLevelMaps[key];
    }
    this.#tiledLevelMaps[key] = this.make.tilemap({ key });
    return this.#tiledLevelMaps[key];
  }

  /**
   * Transitions to the BattleScene and passes along the provided data.
   * @param {import('./battle-scene.js').BattleSceneData} battleSceneData
   */
  #startBattleScene(battleSceneData) {
    this.cameras.main.fadeOut(2000);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.BATTLE_SCENE, battleSceneData);
    });
  }
}
