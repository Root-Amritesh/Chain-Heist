import { createMulberry32, findFairSpawn, validateSpawn, isInForwardBuffer, isReachableBFS, cellKey } from './src/minigames/snake-engine.js';
import { SNAKE_CONFIG } from './src/minigames/snake.config.js';

console.log('Running 10,000 spawn simulation fairness test...');

const rng = createMulberry32(1234567);
let totalSpawnsTested = 0;
let acceptedSpawns = 0;

for (let i = 0; i < 10000; i++) {
  // Generate random snake
  const headCol = 5 + Math.floor(rng() * 18);
  const headRow = 3 + Math.floor(rng() * 9);
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  const dir = dirs[Math.floor(rng() * dirs.length)];

  const snakeLength = 3 + Math.floor(rng() * 10);
  const snakeBody = [{ col: headCol, row: headRow }];
  let cur = { col: headCol, row: headRow };
  for (let s = 1; s < snakeLength; s++) {
    const oppDir = { x: -dir.x, y: -dir.y };
    cur = { col: cur.col + oppDir.x, row: cur.row + oppDir.y };
    snakeBody.push(cur);
  }

  // Generate some obstacles (0 to 6)
  const obstacles = [];
  const numObs = Math.floor(rng() * 7);
  for (let o = 0; o < numObs; o++) {
    const ox = Math.floor(rng() * SNAKE_CONFIG.GRID.COLS);
    const oy = Math.floor(rng() * SNAKE_CONFIG.GRID.ROWS);
    // Don't place on snake
    if (!snakeBody.some(seg => seg.col === ox && seg.row === oy)) {
      obstacles.push({ col: ox, row: oy });
    }
  }

  // Generate some existing rewards (0 to 3)
  const rewards = [];
  const numRew = Math.floor(rng() * 4);
  for (let r = 0; r < numRew; r++) {
    const rx = Math.floor(rng() * SNAKE_CONFIG.GRID.COLS);
    const ry = Math.floor(rng() * SNAKE_CONFIG.GRID.ROWS);
    if (!snakeBody.some(seg => seg.col === rx && seg.row === ry) &&
        !obstacles.some(ob => ob.col === rx && ob.row === ry)) {
      rewards.push({ col: rx, row: ry });
    }
  }

  const isObstacle = rng() > 0.5;
  const spawn = findFairSpawn(snakeBody, dir, obstacles, rewards, rng, isObstacle, 10);
  totalSpawnsTested++;

  if (spawn) {
    acceptedSpawns++;

    // 1. Overlap with snake
    for (const seg of snakeBody) {
      if (spawn.col === seg.col && spawn.row === seg.row) {
        throw new Error(`FAIL: Spawn overlapped snake body at (${spawn.col}, ${spawn.row})`);
      }
    }

    // 2. Overlap with obstacles
    for (const obs of obstacles) {
      if (spawn.col === obs.col && spawn.row === obs.row) {
        throw new Error(`FAIL: Spawn overlapped obstacle at (${spawn.col}, ${spawn.row})`);
      }
    }

    // 3. Overlap with rewards
    for (const rew of rewards) {
      if (spawn.col === rew.col && spawn.row === rew.row) {
        throw new Error(`FAIL: Spawn overlapped reward at (${spawn.col}, ${spawn.row})`);
      }
    }

    // 4. In 3-cell forward zone
    if (isInForwardBuffer(spawn, snakeBody[0], dir, 3)) {
      throw new Error(`FAIL: Spawn appeared in 3-cell forward buffer at (${spawn.col}, ${spawn.row})`);
    }

    // 5. BFS reachability: all rewards reachable
    const blockedSet = new Set();
    for (const seg of snakeBody) blockedSet.add(cellKey(seg.col, seg.row));
    for (const obs of obstacles) blockedSet.add(cellKey(obs.col, obs.row));
    if (isObstacle) blockedSet.add(cellKey(spawn.col, spawn.row));

    for (const rew of rewards) {
      if (!isReachableBFS(snakeBody[0], rew, blockedSet)) {
        throw new Error(`FAIL: Reward at (${rew.col}, ${rew.row}) became unreachable after spawn!`);
      }
    }

    // If it's a reward, it must be reachable from head
    if (!isObstacle) {
      if (!isReachableBFS(snakeBody[0], spawn, blockedSet)) {
        throw new Error(`FAIL: Reward spawn at (${spawn.col}, ${spawn.row}) is not reachable!`);
      }
    }
  }
}

console.log(`SUCCESS! 10,000 spawns simulated. Tested: ${totalSpawnsTested}, Valid Accepted: ${acceptedSpawns}.`);
console.log('Zero overlaps, zero unreachable rewards, zero spawns in forward zone.');

