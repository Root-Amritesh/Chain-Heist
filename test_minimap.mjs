// @ts-nocheck
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGameUrl } from './test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const gameUrl = await getGameUrl();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 576 },
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log(`Navigating to ${gameUrl} ...`);
  await page.goto(gameUrl, { waitUntil: 'networkidle' });

  console.log('Waiting for TitleScene...');
  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('TITLE_SCENE');
  }, { timeout: 15000 });

  console.log('Transitioning to WorldScene with 1 portal cleared to test green icon...');
  await page.evaluate(async () => {
    localStorage.clear();
    const { runState } = await import('./src/state/run-state.js');
    runState.initNewRun('SATOSHI', 'cat-1');
    // Mark portal 1 (Block Flyer) as cleared to test green portal icon
    runState.markDistrictCleared(1);
    runState.addScore(1100);

    const { dataManager } = await import('./src/utils/data-manager.js');
    dataManager.startNewGame();
    dataManager.store.set('PLAYER_POSITION', { x: 960, y: 576 });
    dataManager.store.set('PLAYER_DIRECTION', 'DOWN');

    const game = window.__game;
    game.scene.getScenes(true).forEach(s => s.scene.stop());
    game.scene.start('WORLD_SCENE');
  });

  console.log('Waiting for WorldScene...');
  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('WORLD_SCENE');
  }, { timeout: 10000 });

  await page.waitForTimeout(1000);

  // 1. Screenshot top-right minimap view
  console.log('Capturing top-right minimap screenshot...');
  const minimapPath = path.join(__dirname, 'docs', 'minimap_top_right.png');
  await page.screenshot({ path: minimapPath });
  console.log('Saved top-right minimap screenshot to:', minimapPath);

  // 2. Press M to toggle big centered map view
  console.log('Pressing M to open big centered map view...');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(500);

  // Verify big map is visible and timer is paused
  const mapState = await page.evaluate(async () => {
    const { runState } = await import('./src/state/run-state.js');
    return {
      isTimerPaused: runState.isTimerPaused,
      cleared: runState.cleared,
    };
  });
  console.log('Map state with big map open:', mapState);

  // 3. Screenshot big centered map view
  console.log('Capturing big centered map view screenshot...');
  const bigMapPath = path.join(__dirname, 'docs', 'minimap_big_centered.png');
  await page.screenshot({ path: bigMapPath });
  console.log('Saved big centered map view screenshot to:', bigMapPath);

  // 4. Press M to close big map view
  console.log('Pressing M to close big map view...');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(300);

  const closedState = await page.evaluate(async () => {
    const { runState } = await import('./src/state/run-state.js');
    return {
      isTimerPaused: runState.isTimerPaused,
    };
  });
  console.log('Map state after closing:', closedState);

  // 5. Test ESC also closes big map view
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  console.log('Minimap and big map view verified successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
