/**
 * CHAIN SNAKE ENGINE
 * Seeded PRNG, BFS reachability, fairness checks, and spawn algorithms for Chain Snake.
 */

import { SNAKE_CONFIG } from './snake.config.js';

/**
 * Creates a deterministic Mulberry32 PRNG from numeric or string seed
 * @param {number | string} seed
 * @returns {() => number} Float in range [0, 1)
 */
export function createMulberry32(seed) {
  let s = 0;
  if (typeof seed === 'number') {
    s = seed | 0;
  } else if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
    }
  } else {
    s = 1337;
  }

  return function next() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Encodes grid coordinates into a string key 'col,row'
 * @param {number} col
 * @param {number} row
 * @returns {string}
 */
export function cellKey(col, row) {
  return `${col},${row}`;
}

/**
 * Decodes string key into grid coordinates
 * @param {string} key
 * @returns {{ col: number, row: number }}
 */
export function parseKey(key) {
  const [c, r] = key.split(',').map(Number);
  return { col: c, row: r };
}

/**
 * Checks if a cell is within grid bounds
 * @param {number} col
 * @param {number} row
 * @param {number} [cols=28]
 * @param {number} [rows=15]
 * @returns {boolean}
 */
export function isInBounds(col, row, cols = SNAKE_CONFIG.GRID.COLS, rows = SNAKE_CONFIG.GRID.ROWS) {
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

/**
 * Returns array of 4-way adjacent neighbor cells that are inside bounds
 * @param {number} col
 * @param {number} row
 * @param {number} [cols]
 * @param {number} [rows]
 * @returns {Array<{col: number, row: number}>}
 */
export function getNeighbors(col, row, cols = SNAKE_CONFIG.GRID.COLS, rows = SNAKE_CONFIG.GRID.ROWS) {
  const candidates = [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ];
  return candidates.filter(c => isInBounds(c.col, c.row, cols, rows));
}

/**
 * BFS: Checks if target is reachable from start without passing through blocked set
 * @param {{col: number, row: number}} start
 * @param {{col: number, row: number}} target
 * @param {Set<string>} blockedSet Set of 'col,row' strings
 * @param {number} [cols]
 * @param {number} [rows]
 * @returns {boolean}
 */
export function isReachableBFS(start, target, blockedSet, cols = SNAKE_CONFIG.GRID.COLS, rows = SNAKE_CONFIG.GRID.ROWS) {
  if (start.col === target.col && start.row === target.row) return true;
  const targetKey = cellKey(target.col, target.row);
  const visited = new Set();
  const queue = [start];
  visited.add(cellKey(start.col, start.row));

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = getNeighbors(current.col, current.row, cols, rows);

    for (const nb of neighbors) {
      const key = cellKey(nb.col, nb.row);
      if (key === targetKey) return true;
      if (!visited.has(key) && !blockedSet.has(key)) {
        visited.add(key);
        queue.push(nb);
      }
    }
  }

  return false;
}

/**
 * BFS: Counts total connected traversable cells from start
 * @param {{col: number, row: number}} start
 * @param {Set<string>} blockedSet
 * @param {number} [cols]
 * @param {number} [rows]
 * @returns {number}
 */
export function countTraversableBFS(start, blockedSet, cols = SNAKE_CONFIG.GRID.COLS, rows = SNAKE_CONFIG.GRID.ROWS) {
  const visited = new Set();
  const queue = [start];
  visited.add(cellKey(start.col, start.row));

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = getNeighbors(current.col, current.row, cols, rows);

    for (const nb of neighbors) {
      const key = cellKey(nb.col, nb.row);
      if (!visited.has(key) && !blockedSet.has(key)) {
        visited.add(key);
        queue.push(nb);
      }
    }
  }

  return visited.size;
}

/**
 * Checks whether a candidate cell lies within the forward buffer (3 cells ahead of snake head)
 * @param {{col: number, row: number}} cell
 * @param {{col: number, row: number}} head
 * @param {{x: number, y: number}} direction
 * @param {number} [bufferCells=3]
 * @returns {boolean}
 */
export function isInForwardBuffer(cell, head, direction, bufferCells = SNAKE_CONFIG.FAIRNESS.FORWARD_BUFFER_CELLS) {
  if (direction.x === 0 && direction.y === 0) return false;

  for (let i = 1; i <= bufferCells; i++) {
    const forwardCol = head.col + direction.x * i;
    const forwardRow = head.row + direction.y * i;
    if (cell.col === forwardCol && cell.row === forwardRow) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a spawn according to hard fairness rules:
 * 1. Inside bounds
 * 2. Not overlapping snake body
 * 3. Not overlapping existing obstacles
 * 4. Not overlapping active rewards
 * 5. Not within 3 cells forward of head
 * 6. Keeps escape route for head (BFS count >= MIN_HEAD_ESCAPE_SPACE)
 * 7. Keeps all active rewards reachable from head (BFS reachability)
 *
 * @param {{col: number, row: number}} candidate
 * @param {Array<{col: number, row: number}>} snakeBody
 * @param {{x: number, y: number}} direction
 * @param {Array<{col: number, row: number}>} obstacles
 * @param {Array<{col: number, row: number}>} rewards
 * @param {boolean} isObstacle
 * @param {number} [cols]
 * @param {number} [rows]
 * @returns {boolean}
 */
export function validateSpawn(
  candidate,
  snakeBody,
  direction,
  obstacles = [],
  rewards = [],
  isObstacle = false,
  cols = SNAKE_CONFIG.GRID.COLS,
  rows = SNAKE_CONFIG.GRID.ROWS
) {
  // 1. Bounds check
  if (!isInBounds(candidate.col, candidate.row, cols, rows)) return false;

  const candKey = cellKey(candidate.col, candidate.row);

  // 2. Snake body overlap check
  for (const seg of snakeBody) {
    if (candKey === cellKey(seg.col, seg.row)) return false;
  }

  // 3. Obstacle overlap check
  for (const obs of obstacles) {
    if (candKey === cellKey(obs.col, obs.row)) return false;
  }

  // 4. Reward overlap check
  for (const rew of rewards) {
    if (candKey === cellKey(rew.col, rew.row)) return false;
  }

  const head = snakeBody[0] || { col: 14, row: 7 };

  // 5. Forward buffer check (never spawn within 3 cells directly ahead of head)
  if (isInForwardBuffer(candidate, head, direction, SNAKE_CONFIG.FAIRNESS.FORWARD_BUFFER_CELLS)) {
    return false;
  }

  // 6 & 7. BFS Reachability & Escape checks (especially critical when placing an obstacle)
  const blockedSet = new Set();
  for (const seg of snakeBody) blockedSet.add(cellKey(seg.col, seg.row));
  for (const obs of obstacles) blockedSet.add(cellKey(obs.col, obs.row));
  if (isObstacle) blockedSet.add(candKey);

  // Check escape route space
  const escapeSpace = countTraversableBFS(head, blockedSet, cols, rows);
  const minRequiredSpace = Math.min(
    SNAKE_CONFIG.FAIRNESS.MIN_HEAD_ESCAPE_SPACE,
    cols * rows - blockedSet.size - 5
  );
  if (escapeSpace < minRequiredSpace) {
    return false;
  }

  // Check that all existing rewards remain reachable from head
  for (const rew of rewards) {
    if (!isReachableBFS(head, rew, blockedSet, cols, rows)) {
      return false;
    }
  }

  // If candidate is a reward, ensure candidate itself is reachable from head
  if (!isObstacle) {
    if (!isReachableBFS(head, candidate, blockedSet, cols, rows)) {
      return false;
    }
  }

  return true;
}

/**
 * Finds a fair spawn location with up to maxRetries attempts
 * @param {Array<{col: number, row: number}>} snakeBody
 * @param {{x: number, y: number}} direction
 * @param {Array<{col: number, row: number}>} obstacles
 * @param {Array<{col: number, row: number}>} rewards
 * @param {() => number} rng
 * @param {boolean} [isObstacle=false]
 * @param {number} [maxRetries=10]
 * @param {number} [cols]
 * @param {number} [rows]
 * @returns {{col: number, row: number} | null}
 */
export function findFairSpawn(
  snakeBody,
  direction,
  obstacles = [],
  rewards = [],
  rng = Math.random,
  isObstacle = false,
  maxRetries = SNAKE_CONFIG.FAIRNESS.MAX_SPAWN_ATTEMPTS,
  cols = SNAKE_CONFIG.GRID.COLS,
  rows = SNAKE_CONFIG.GRID.ROWS
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const col = Math.floor(rng() * cols);
    const row = Math.floor(rng() * rows);
    const candidate = { col, row };

    if (validateSpawn(candidate, snakeBody, direction, obstacles, rewards, isObstacle, cols, rows)) {
      return candidate;
    }
  }

  return null;
}

