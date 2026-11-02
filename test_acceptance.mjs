import { MiniGameClock } from './src/minigames/clock.js';
import { createMulberry32, findFairSpawn, isInForwardBuffer, isReachableBFS, cellKey } from './src/minigames/snake-engine.js';
import { SNAKE_CONFIG } from './src/minigames/snake.config.js';
import { mongoLeaderboard, checkRateLimit, generateETag } from './server/mongo-leaderboard.js';

console.log('=== STARTING SUITE ACCEPTANCE TESTS ===\n');

// -------------------------------------------------------------
// PART A: MiniGameClock Acceptance Test
// -------------------------------------------------------------
console.log('[TEST A] Verifying MiniGameClock monotonic behavior...');
{
  const clock = new MiniGameClock();
  let expiredCount = 0;
  clock.on('expired', () => { expiredCount++; });

  clock.start(1000, 10000);
  if (clock.remaining !== 1000) throw new Error('Clock initial remaining mismatch');

  // Advance to 500ms
  clock.update(10500);
  if (clock.remaining !== 500) throw new Error(`Expected 500ms remaining, got ${clock.remaining}`);

  // Test Pause
  clock.pause(10600);
  clock.update(11000); // Clock paused, remaining should freeze at 400ms
  if (clock.remaining !== 400) throw new Error(`Expected paused remaining 400ms, got ${clock.remaining}`);

  // Test Resume
  clock.resume(12000);
  clock.update(12200);
  if (clock.remaining !== 200) throw new Error(`Expected 200ms remaining, got ${clock.remaining}`);

  // Test addTime (+500ms)
  clock.addTime(500);
  if (clock.remaining !== 700) throw new Error(`Expected 700ms after addTime, got ${clock.remaining}`);

  // Advance past expiry
  clock.update(13000);
  if (clock.remaining !== 0) throw new Error('Expected remaining 0 after expiry');
  if (expiredCount !== 1) throw new Error(`Expired must fire exactly once! Fired: ${expiredCount}`);

  // Multiple updates after expiry must NOT trigger expired again
  clock.update(14000);
  if (expiredCount !== 1) throw new Error(`Expired fired again! Count: ${expiredCount}`);

  clock.destroy();
  console.log('  -> MiniGameClock monotonic test PASSED.');
}

// -------------------------------------------------------------
// PART B: Chain Snake 10,000 Spawns Fairness Simulation
// -------------------------------------------------------------
console.log('\n[TEST B] Simulating 10,000 Chain Snake spawns with hard fairness rules...');
{
  const rng = createMulberry32(987654321);
  let checked = 0;

  for (let i = 0; i < 10000; i++) {
    const headCol = 5 + Math.floor(rng() * 18);
    const headRow = 3 + Math.floor(rng() * 9);
    const dir = { x: 1, y: 0 };
    const snakeBody = [
      { col: headCol, row: headRow },
      { col: headCol - 1, row: headRow },
      { col: headCol - 2, row: headRow },
    ];

    const obstacles = [{ col: 1, row: 1 }, { col: 20, row: 12 }];
    const rewards = [{ col: 15, row: 5 }];

    const spawn = findFairSpawn(snakeBody, dir, obstacles, rewards, rng, false, 10);
    if (spawn) {
      checked++;
      // No overlap with snake
      if (snakeBody.some(s => s.col === spawn.col && s.row === spawn.row)) {
        throw new Error('Overlap with snake body detected');
      }
      // No overlap with obstacles
      if (obstacles.some(o => o.col === spawn.col && o.row === spawn.row)) {
        throw new Error('Overlap with obstacle detected');
      }
      // No overlap with rewards
      if (rewards.some(r => r.col === spawn.col && r.row === spawn.row)) {
        throw new Error('Overlap with reward detected');
      }
      // Never in 3-cell forward zone
      if (isInForwardBuffer(spawn, snakeBody[0], dir, 3)) {
        throw new Error('Spawned in forward buffer');
      }
      // BFS reachable
      const blocked = new Set();
      snakeBody.forEach(s => blocked.add(cellKey(s.col, s.row)));
      obstacles.forEach(o => blocked.add(cellKey(o.col, o.row)));
      if (!isReachableBFS(snakeBody[0], spawn, blocked)) {
        throw new Error('Spawned reward unreachable via BFS');
      }
    }
  }
  console.log(`  -> 10,000 spawns checked (valid accepted: ${checked}). Hard fairness PASSED.`);
}

// -------------------------------------------------------------
// PART C: Leaderboard Consensus, Name, ETag & Rate Limit
// -------------------------------------------------------------
console.log('\n[TEST C] Verifying Leaderboard Name, Validation, ETag & Rate Limiting...');
{
  // 1. Play as Name A
  const codeA = `#A111-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  const resA = await mongoLeaderboard.submitScore({
    name: 'ALICE_99',
    score: 3200,
    districts: 3,
    tokens: 4,
    badge: 'SILVER',
    verificationCode: codeA,
  });
  if (!resA.success) throw new Error(`Player A submit failed: ${resA.error}`);

  // 2. Play as Name B
  const codeB = `#B222-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  const resB = await mongoLeaderboard.submitScore({
    name: 'BOB_RUNNER',
    score: 4500,
    districts: 4,
    tokens: 7,
    badge: 'GOLD',
    verificationCode: codeB,
  });
  if (!resB.success) throw new Error(`Player B submit failed: ${resB.error}`);

  // Query top scores
  const topList = await mongoLeaderboard.getTop(50, 'all');
  const foundA = topList.find(e => e.verificationCode === codeA);
  const foundB = topList.find(e => e.verificationCode === codeB);

  if (!foundA || foundA.name !== 'ALICE_99') throw new Error('Player A not found with correct name in consensus');
  if (!foundB || foundB.name !== 'BOB_RUNNER') throw new Error('Player B not found with correct name in consensus');
  console.log(`  -> Both Player A (${foundA.name}) and Player B (${foundB.name}) verified in consensus.`);

  // 3. ETag generation test
  const etag1 = generateETag(topList);
  const etag2 = generateETag(topList);
  if (etag1 !== etag2 || !etag1.startsWith('"')) throw new Error('ETag generation invalid');
  console.log(`  -> ETag generated: ${etag1}`);

  // 4. Schema validation tests
  const invalidNameRes = await mongoLeaderboard.submitScore({
    name: '!!INVALID!!',
    score: 1000,
  });
  if (invalidNameRes.success) throw new Error('Invalid name should have been rejected');

  const tamperedScoreRes = await mongoLeaderboard.submitScore({
    name: 'HACKER_SCORE',
    score: 999999, // Exceeds 50,000 cap
  });
  if (tamperedScoreRes.success) throw new Error('Tampered score > 50,000 should have been rejected');
  console.log('  -> Tampered score and invalid name successfully rejected.');

  // 5. Rate limit test (10 requests per minute per IP)
  const testIp = '192.168.1.100';
  let allowedCount = 0;
  for (let i = 0; i < 15; i++) {
    if (checkRateLimit(testIp)) {
      allowedCount++;
    }
  }
  if (allowedCount !== 10) throw new Error(`Rate limit should allow exactly 10 requests, allowed: ${allowedCount}`);
  console.log(`  -> Rate limiter verified: allowed 10 requests, blocked ${15 - allowedCount} excess requests.`);
}

console.log('\n=== ALL SUITE ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');

