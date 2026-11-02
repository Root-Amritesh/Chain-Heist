import { MiniGameClock } from './src/minigames/clock.js';
import assert from 'assert';

console.log('Testing MiniGameClock...');

// 1. Basic initialization & formatted output
const clock = new MiniGameClock(90000);
assert.strictEqual(clock.remaining, 90000);
assert.strictEqual(clock.formatted, '01:30');
assert.strictEqual(clock.isRunning, false);
assert.strictEqual(clock.isPaused, false);
console.log('✓ 1. Initial state check passed');

// 2. Start & simulated monotonic progression
let mockTime = 1000;
clock.start(20000, mockTime); // 20s
assert.strictEqual(clock.isRunning, true);
assert.strictEqual(clock.hasExpired, false);

// Advance by 5000ms
mockTime += 5000;
clock.update(mockTime);
assert.strictEqual(clock.remaining, 15000);
assert.strictEqual(clock.formatted, '00:15');
console.log('✓ 2. Monotonic update passed: 20s -> 15s');

// 3. Pause & Resume
clock.pause();
assert.strictEqual(clock.isPaused, true);

// Elapse 10000ms while paused
mockTime += 10000;
clock.update(mockTime);
assert.strictEqual(clock.remaining, 15000, 'Remaining time should not change while paused');

clock.resume(mockTime);
assert.strictEqual(clock.isPaused, false);

// Now advance 3000ms after resume
mockTime += 3000;
clock.update(mockTime);
assert.strictEqual(clock.remaining, 12000, 'Time should resume correctly after unpausing');
console.log('✓ 3. Pause / resume passed (paused time not counted)');

// 4. Expired event fires EXACTLY once
let expiredCount = 0;
clock.onExpired(() => {
  expiredCount++;
});

// Advance 15000ms past expiration
mockTime += 15000;
clock.update(mockTime);
assert.strictEqual(clock.remaining, 0);
assert.strictEqual(clock.hasExpired, true);
assert.strictEqual(expiredCount, 1, 'Expired listener should fire once');

// Further updates should NOT re-fire expired
mockTime += 5000;
clock.update(mockTime);
assert.strictEqual(expiredCount, 1, 'Expired listener must not fire again after already expired');
console.log('✓ 4. Expired fires exactly once');

// 5. Add time bonus
clock.reset(10000);
mockTime = 50000;
clock.start(10000, mockTime);
mockTime += 2000;
clock.update(mockTime);
clock.addTime(5000); // +5s bonus
assert.strictEqual(clock.remaining, 13000);
console.log('✓ 5. Add time bonus (+5s) passed');

// 6. Destroy
clock.destroy();
assert.strictEqual(clock.isRunning, false);
console.log('✓ 6. Destroy passed');

// 7. Real-time accuracy test (simulate 2 seconds of real wall-clock time)
const realClock = new MiniGameClock(10000);
realClock.start();
const startRemaining = realClock.remaining;
await new Promise(resolve => setTimeout(resolve, 2000));
const endRemaining = realClock.remaining;
const deltaSeconds = (startRemaining - endRemaining) / 1000;
console.log(`Real time elapsed over 2000ms: ${deltaSeconds.toFixed(3)}s`);
assert.ok(Math.abs(deltaSeconds - 2.0) <= 0.05, `Timer drift must be <= 0.05s over 2s (got ${deltaSeconds}s)`);
realClock.destroy();
console.log('✓ 7. Real-time monotonic accuracy passed (2.0 +/- 0.05s)');

console.log('ALL MiniGameClock TESTS PASSED!');
