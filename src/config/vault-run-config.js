/**
 * VAULT RUN (Cryptographic Ledger Run) Configuration
 * Single source of truth for maze dimensions, speeds, scoring, and layout
 */

export const VAULT_TILE_SIZE = 16;
export const VAULT_MAZE_COLS = 28;
export const VAULT_MAZE_ROWS = 22;
export const VAULT_OFFSET_X = Math.floor((1024 - VAULT_MAZE_COLS * VAULT_TILE_SIZE) / 2); // 288
export const VAULT_OFFSET_Y = 100; // Vertically centered in 576 viewport

export const VAULT_SESSION_LIMIT_SEC = 90;
export const VAULT_FRIGHTENED_DURATION_MS = 6000;
export const VAULT_INVULNERABILITY_MS = 1500;

export const VAULT_PLAYER_SPEED = 2.0;
export const VAULT_APE_NORMAL_SPEED = 1.6;
export const VAULT_APE_FRIGHTENED_SPEED = 1.0;

export const VAULT_PELLET_VALUE = 10;
export const VAULT_POWER_COIN_VALUE = 50;
export const VAULT_APE_EAT_VALUE = 200;

export const VAULT_PLAYER_SPAWN = Object.freeze({
  col: 14,
  row: 16,
  dirX: -1,
  dirY: 0,
});

export const VAULT_APE_CONFIGS = Object.freeze([
  // Blinky: Red Shadow Ape - direct aggressive chaser (targets player's exact tile)
  { id: 1, name: 'SHADOW APE', asset: 'HACKER_APE_1', homeCol: 13, homeRow: 10, releaseDelayMs: 0, personality: 'blinky', scatterTarget: { col: 25, row: 0 } },
  // Pinky: Cyber Ape - ambusher (targets 4 tiles ahead of player)
  { id: 2, name: 'CYBER APE', asset: 'HACKER_APE_2', homeCol: 14, homeRow: 10, releaseDelayMs: 3000, personality: 'pinky', scatterTarget: { col: 2, row: 0 } },
  // Inky: Rogue Ape - flanker (dual vector targeting)
  { id: 3, name: 'ROGUE APE', asset: 'HACKER_APE_3', homeCol: 13, homeRow: 11, releaseDelayMs: 6000, personality: 'inky', scatterTarget: { col: 27, row: 21 } },
  // Clyde: Glitch Ape - cowardly tracker (chases if > 8 tiles away, retreats to corner if closer)
  { id: 4, name: 'GLITCH APE', asset: 'ape-4', homeCol: 14, homeRow: 11, releaseDelayMs: 9000, personality: 'clyde', scatterTarget: { col: 0, row: 21 } },
]);

export const VAULT_WRAP_ROW = 10;

/**
 * 28x22 Authentic Arcade Pac-Man Style Maze Grid
 * '#' = Wall
 * '.' = Standard Pellet (+10)
 * 'O' = Corner Power Coin (+50)
 * ' ' = Open Path
 * 'V' = Vault (Ghost House)
 * '-' = Vault Door (passable only by apes)
 */
export const VAULT_MAZE_GRID = Object.freeze([
  '############################', // 0
  '#............##............#', // 1
  '#O####.#####.##.#####.####O#', // 2
  '#.####.#####.##.#####.####.#', // 3
  '#..........................#', // 4
  '#.####.##.########.##.####.#', // 5
  '#......##....##....##......#', // 6
  '######.##### ## #####.######', // 7
  '     #.##          ##.#     ', // 8
  '######.## ###--### ##.######', // 9
  '          # VVVV #          ', // 10 (tunnel row)
  '######.## # VVVV # ##.######', // 11
  '     #.## ######## ##.#     ', // 12
  '######.##    ##    ##.######', // 13
  '#............##............#', // 14
  '#.####.#####.  .#####.####.#', // 15
  '#O..##.......  .......##..O#', // 16 (player spawn at 14, 16)
  '###.##.##.##    ##.##.##.###', // 17
  '#......##....##....##......#', // 18
  '#.##########.##.##########.#', // 19
  '#..........................#', // 20
  '############################'  // 21
]);
