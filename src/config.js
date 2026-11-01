export const ENABLE_ZONE_DEBUGGING = false;
export const SHOW_SOCIAL_LINKS = false;
export const TILE_SIZE = 64;
export const TILED_COLLISION_LAYER_ALPHA = 0;

// Map constants — single source of truth
export const MAP_TILE_SIZE = 16;
export const MAP_COLS = 120;
export const MAP_ROWS = 72;
export const MAP_WIDTH = 1920;   // MAP_COLS * MAP_TILE_SIZE
export const MAP_HEIGHT = 1152;  // MAP_ROWS * MAP_TILE_SIZE
export const WORLD_WIDTH = MAP_WIDTH;
export const WORLD_HEIGHT = MAP_HEIGHT;

// Continuous movement speeds (px/s)
export const SPEED = 150;
export const PLAYER_SPEED = 150;
export const PLAYER_RUN_SPEED = 250;

// Normalized sprite display heights (px)
export const CAT_DISPLAY_HEIGHT = 46;
export const NPC_DISPLAY_HEIGHT = 50;
export const APE_DISPLAY_HEIGHT = 50;

// Player feet hitbox (in map pixels)
export const FEET_BOX_WIDTH = 16;
export const FEET_BOX_HEIGHT = 8;

// NPC interaction radius in world pixels (56px)
export const NPC_INTERACTION_RADIUS = 56;

// Scoring constants — single source of truth
export const COIN_VALUE = 20;
export const TOKEN_VALUE = 50;
export const DISTRICT_CLEAR_BONUS = 1000;
export const TIME_BONUS_PER_SECOND = 10;
export const LIFE_BONUS_PER_HEART = 300;
export const PARTICIPATION_BONUS = 500;
export const MAX_MINIGAME_SCORE = 2000;
export const MAX_DISTRICTS = 4;
export const MAX_POSSIBLE_SCORE = 15000;
export const SCORE_SUBMISSION_RATE_LIMIT_MS = 2000;

// Canonical player spawn point
export const DEFAULT_PLAYER_SPAWN = Object.freeze({ x: 590, y: 480 });

export const TEXT_SPEED = Object.freeze({
  SLOW: 50,
  MEDIUM: 30,
  FAST: 15,
});
export const MENU_COLOR = Object.freeze({
  1: {
    main: 0x120A22,
    border: 0x3FF0FF,
  },
  2: {
    main: 0x120A22,
    border: 0x3FF0FF,
  },
  3: {
    main: 0x120A22,
    border: 0x3FF0FF,
  },
});
