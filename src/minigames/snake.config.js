/**
 * CHAIN SNAKE CONFIGURATION
 * All balance numbers, tuning constants, and mechanics for District 3 Chain Snake.
 */

export const SNAKE_CONFIG = Object.freeze({
  // Grid layout
  GRID: Object.freeze({
    COLS: 28,
    ROWS: 15,
    CELL_SIZE: 32,
    OFFSET_X: 64, // (1024 - 28 * 32) / 2
    OFFSET_Y: 80, // (576 - 15 * 32) / 2 + 16 (below top HUD)
  }),

  // Timing & Duration
  TIMING: Object.freeze({
    TOTAL_TIME_SEC: 90,
    START_TICK_MS: 180,
    MIN_TICK_MS: 90,
    RAMP_DURATION_SEC: 90,
  }),

  // Win condition
  WIN_BLOCKS: 15,

  // Obstacles
  OBSTACLES: Object.freeze({
    INITIAL_FIREWALL_MIN: 3,
    INITIAL_FIREWALL_MAX: 6,
    FIREWALL_CLUSTER_SIZE_MIN: 1,
    FIREWALL_CLUSTER_SIZE_MAX: 3,
    FIREWALL_ADD_INTERVAL_SEC: 20,
    FIREWALL_MAX_CLUSTERS: 8,

    DRONE_COUNT: 2,
    DRONE_STEP_MS: 400,

    CORRUPTED_CELL_INTERVAL_SEC: 15,
    CORRUPTED_TELEGRAPH_MS: 1000,
    CORRUPTED_ACTIVE_MS: 6000,
  }),

  // Rewards & Powerups
  REWARDS: Object.freeze({
    COIN_POINTS: 10,
    DATA_CRYSTAL_POINTS: 50,
    TIME_SHARD_BONUS_SEC: 5,

    MAGNET_DURATION_MS: 8000,
    MAGNET_RADIUS_CELLS: 4,

    SLOW_MO_DURATION_MS: 6000,
    SLOW_MO_SPEED_FACTOR: 0.6, // 60% speed -> longer interval = slower

    SCORE_X2_DURATION_MS: 10000,

    COMBO_WINDOW_MS: 3000,
    COMBO_MAX_MULTIPLIER: 5,

    VIRUS_DURATION_MS: 3000,
    VIRUS_PENALTY_POINTS: -20,
  }),

  // Fairness constraints
  FAIRNESS: Object.freeze({
    FORWARD_BUFFER_CELLS: 3,
    MAX_SPAWN_ATTEMPTS: 10,
    MIN_HEAD_ESCAPE_SPACE: 10,
  }),
});

