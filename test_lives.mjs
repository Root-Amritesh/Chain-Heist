// @ts-nocheck
import assert from 'assert';
import { LivesManager, INITIAL_LIVES } from './src/systems/lives-manager.js';
import { ScoreManager } from './src/systems/score-manager.js';
import { runState } from './src/state/run-state.js';

console.log('=== RUNNING LIVES SYSTEM UNIT TESTS ===\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Test 1: 3 different deaths -> lives 2, 1, 0 and Game Over fires once
// -------------------------------------------------------------
test('3 different deaths -> lives 2, 1, 0 and Game Over fires once', () => {
  LivesManager.reset(3);
  assert.strictEqual(LivesManager.getLives(), 3, 'Initial lives should be 3');

  let gameOverCount = 0;
  const unsubGameOver = LivesManager.onGameOver(() => {
    gameOverCount++;
  });

  const changes = [];
  const unsubChange = LivesManager.onChange((lives) => {
    changes.push(lives);
  });

  // Death 1
  const id1 = LivesManager.createDeathId();
  const livesAfter1 = LivesManager.loseLife({ reason: 'hit_obstacle', deathId: id1 });
  assert.strictEqual(livesAfter1, 2, 'Lives should be 2 after first death');
  assert.strictEqual(LivesManager.getLives(), 2);
  assert.strictEqual(gameOverCount, 0, 'Game Over should not fire yet');

  // Death 2
  const id2 = LivesManager.createDeathId();
  const livesAfter2 = LivesManager.loseLife({ reason: 'laser_trap', deathId: id2 });
  assert.strictEqual(livesAfter2, 1, 'Lives should be 1 after second death');
  assert.strictEqual(LivesManager.getLives(), 1);
  assert.strictEqual(gameOverCount, 0, 'Game Over should not fire yet');

  // Death 3
  const id3 = LivesManager.createDeathId();
  const livesAfter3 = LivesManager.loseLife({ reason: 'timeout', deathId: id3 });
  assert.strictEqual(livesAfter3, 0, 'Lives should be 0 after third death');
  assert.strictEqual(LivesManager.getLives(), 0);
  assert.strictEqual(gameOverCount, 1, 'Game Over should fire exactly once');

  // Subsequent call when already at 0
  const id4 = LivesManager.createDeathId();
  const livesAfter4 = LivesManager.loseLife({ reason: 'extra_hit', deathId: id4 });
  assert.strictEqual(livesAfter4, 0, 'Lives should remain 0');
  assert.strictEqual(gameOverCount, 1, 'Game Over must NOT fire a second time (double guard)');

  unsubGameOver();
  unsubChange();
});

// -------------------------------------------------------------
// Test 2: Same death id sent twice -> subtracts once
// -------------------------------------------------------------
test('Same death id sent twice -> subtracts once', () => {
  LivesManager.reset(3);
  const fixedDeathId = 'run_123:death_42';

  const firstCall = LivesManager.loseLife({ reason: 'ape_hit', deathId: fixedDeathId });
  assert.strictEqual(firstCall, 2, 'First call with deathId should deduct life to 2');

  const secondCall = LivesManager.loseLife({ reason: 'ape_hit_duplicate', deathId: fixedDeathId });
  assert.strictEqual(secondCall, 2, 'Second call with identical deathId MUST NOT deduct again (idempotent)');

  const thirdCall = LivesManager.loseLife({ reason: 'ape_battle_retry', deathId: fixedDeathId });
  assert.strictEqual(thirdCall, 2, 'Third call with identical deathId MUST NOT deduct again');
  assert.strictEqual(LivesManager.getLives(), 2, 'Total lives should still be 2');
});

// -------------------------------------------------------------
// Test 3: 3 deaths in the SAME minigame (retry each time) -> 2, 1, 0
// -------------------------------------------------------------
test('3 deaths in the SAME minigame (retry each time) -> 2, 1, 0', () => {
  ScoreManager.clearRun();
  runState.initNewRun('TESTER', 'cat-1');
  assert.strictEqual(LivesManager.getLives(), 3);

  // Attempt 1: player plays chainSnake, dies
  const death1 = ScoreManager.reportGameResult('chainSnake', {
    completed: false,
    deathId: LivesManager.createDeathId(),
    portalId: 1,
  });
  assert.strictEqual(death1.success, true);
  assert.strictEqual(LivesManager.getLives(), 2, 'Lives should drop to 2 on 1st chainSnake loss');

  // Attempt 2: player retries SAME minigame chainSnake, dies again
  const death2 = ScoreManager.reportGameResult('chainSnake', {
    completed: false,
    deathId: LivesManager.createDeathId(),
    portalId: 1,
  });
  assert.strictEqual(death2.success, true);
  assert.strictEqual(LivesManager.getLives(), 1, 'Lives should drop to 1 on 2nd chainSnake loss');

  // Attempt 3: player retries SAME minigame chainSnake, dies third time
  const death3 = ScoreManager.reportGameResult('chainSnake', {
    completed: false,
    deathId: LivesManager.createDeathId(),
    portalId: 1,
  });
  assert.strictEqual(death3.success, true);
  assert.strictEqual(LivesManager.getLives(), 0, 'Lives should drop to 0 on 3rd chainSnake loss');
  assert.strictEqual(LivesManager.isGameOver(), true, 'Game Over condition should be true');

  const breakdown = ScoreManager.computeFinalBreakdown();
  assert.strictEqual(breakdown.livesLeft, 0, 'Breakdown must reflect 0 lives left');
  assert.strictEqual(breakdown.gameOverReason, 'OPERATIVE TERMINATED · INSUFFICIENT LIVES');
});

// -------------------------------------------------------------
// Test 4: 3 deaths across 3 different minigames -> 2, 1, 0
// -------------------------------------------------------------
test('3 deaths across 3 different minigames -> 2, 1, 0', () => {
  ScoreManager.clearRun();
  runState.initNewRun('TESTER', 'cat-1');
  assert.strictEqual(LivesManager.getLives(), 3);

  // Death 1 in blockFlyer
  ScoreManager.reportGameResult('blockFlyer', {
    completed: false,
    deathId: LivesManager.createDeathId(),
    portalId: 3,
  });
  assert.strictEqual(LivesManager.getLives(), 2, 'Lives should be 2 after blockFlyer defeat');

  // Death 2 in vaultRun
  ScoreManager.reportGameResult('vaultRun', {
    completed: false,
    deathId: LivesManager.createDeathId(),
    portalId: 2,
  });
  assert.strictEqual(LivesManager.getLives(), 1, 'Lives should be 1 after vaultRun defeat');

  // Death 3 in chainSnake
  ScoreManager.reportGameResult('chainSnake', {
    completed: false,
    deathId: LivesManager.createDeathId(),
    portalId: 1,
  });
  assert.strictEqual(LivesManager.getLives(), 0, 'Lives should be 0 after chainSnake defeat');
  assert.strictEqual(LivesManager.isGameOver(), true, 'Game Over reached after 3rd minigame death');
});

// -------------------------------------------------------------
// Test 5: Restart minigame / leave and re-enter the world scene between deaths -> lives persist
// -------------------------------------------------------------
test('Restart minigame / leave and re-enter world scene between deaths -> lives persist', () => {
  ScoreManager.clearRun();
  runState.initNewRun('PERSISTENCE_TEST', 'cat-1');
  assert.strictEqual(LivesManager.getLives(), 3);

  // Operative dies once in world / minigame
  LivesManager.loseLife({ reason: 'minigame_lose' });
  assert.strictEqual(LivesManager.getLives(), 2);
  assert.strictEqual(runState.lives, 2);

  // Simulate leaving scene and entering worldScene (calls runState.load() + LivesManager.load())
  runState.load();
  LivesManager.load();
  assert.strictEqual(LivesManager.getLives(), 2, 'Lives must persist at 2 after scene transition load');
  assert.strictEqual(runState.lives, 2);

  // Operative dies second time in a different scene
  LivesManager.loseLife({ reason: 'second_scene_lose' });
  assert.strictEqual(LivesManager.getLives(), 1);

  // Simulate minigame restart (load called again)
  runState.load();
  LivesManager.load();
  assert.strictEqual(LivesManager.getLives(), 1, 'Lives must persist at 1 across restarts');
});

// -------------------------------------------------------------
// Test 6: New run -> back to 3
// -------------------------------------------------------------
test('New run -> back to 3', () => {
  // Exhaust all lives
  LivesManager.loseLife();
  LivesManager.loseLife();
  LivesManager.loseLife();
  assert.strictEqual(LivesManager.getLives(), 0);
  assert.strictEqual(LivesManager.isGameOver(), true);

  // Start brand new run
  runState.initNewRun('FRESH_OPERATIVE', 'cat-2');
  assert.strictEqual(LivesManager.getLives(), 3, 'New run must restore lives to exactly 3');
  assert.strictEqual(runState.lives, 3, 'runState.lives must be restored to 3');
  assert.strictEqual(LivesManager.isGameOver(), false, 'isGameOver must be false after reset');
});

console.log(`\n========================================`);
console.log(`TOTAL: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
