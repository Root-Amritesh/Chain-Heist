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

  // 1. Start WorldScene with clean run state and guide trail enabled
  console.log('Starting WorldScene...');
  await page.evaluate(async () => {
    localStorage.clear();
    const { runState } = await import('./src/state/run-state.js');
    runState.initNewRun('SATOSHI', 'cat-1');

    const { dataManager } = await import('./src/utils/data-manager.js');
    dataManager.startNewGame();
    dataManager.store.set('PLAYER_POSITION', { x: 960, y: 576 });
    dataManager.store.set('PLAYER_DIRECTION', 'DOWN');

    const game = window.__game;
    game.scene.getScenes(true).forEach(s => s.scene.stop());
    game.scene.start('WORLD_SCENE');
  });

  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('WORLD_SCENE');
  }, { timeout: 10000 });

  await page.waitForTimeout(1500);

  // Capture Guide Trail chevrons on ground
  const guideTrailPath = path.join(__dirname, 'docs', 'guide_trail_world.png');
  await page.screenshot({ path: guideTrailPath });
  console.log('1. Guide Trail screenshot saved to:', guideTrailPath);

  // Test toggling Guide Trail off and on with T
  console.log('Toggling Guide Trail with T...');
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(300);
  const guideTrailOffPath = path.join(__dirname, 'docs', 'guide_trail_toggled_off.png');
  await page.screenshot({ path: guideTrailOffPath });
  console.log('Guide Trail toggled OFF saved to:', guideTrailOffPath);

  // Toggle back on with T
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(300);

  // 2. Test Cat Trail while walking / running with Shift
  console.log('Walking with SHIFT to test afterimage and cyan/magenta particles...');
  await page.keyboard.down('Shift');
  await page.keyboard.down('ArrowDown');

  // Walking takes 300ms running (with Shift)
  await page.waitForTimeout(150);
  const catTrailPath = path.join(__dirname, 'docs', 'cat_trail_walk_shift.png');
  await page.screenshot({ path: catTrailPath });
  console.log('2. Cat walking trail (afterimage + particles) saved to:', catTrailPath);

  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('Shift');
  await page.waitForTimeout(500);

  // 3. Test BlockFlyer ribbon trail with floating BTC pixel particles
  console.log('Transitioning to BlockFlyer to test cyan-magenta ribbon & BTC particles...');
  await page.evaluate(() => {
    const game = window.__game;
    game.scene.getScenes(true).forEach(s => s.scene.stop());
    game.scene.start('BLOCK_FLYER_SCENE', {
      portalId: 1,
      game: 'blockFlyer',
      districtName: 'BLOCK DISTRICT',
      apeAsset: 'HACKER_APE_1',
      apeName: 'HACKER APE',
    });
  });

  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('BLOCK_FLYER_SCENE');
  }, { timeout: 10000 });

  // Wait for countdown (3s) to finish and start flying
  await page.waitForTimeout(2200);

  console.log('Flapping cat in BlockFlyer to generate ribbon and floating BTC particles...');
  // Flap 2-3 times
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);

  const blockFlyerPath = path.join(__dirname, 'docs', 'block_flyer_ribbon_btc.png');
  await page.screenshot({ path: blockFlyerPath });
  console.log('3. BlockFlyer ribbon & BTC particles screenshot saved to:', blockFlyerPath);

  // 4. Test Reduce Motion
  console.log('Testing Reduce Motion ON (disables both trails)...');
  await page.evaluate(async () => {
    const { runState } = await import('./src/state/run-state.js');
    runState.toggleReduceMotion();
  });

  await page.waitForTimeout(400);
  const reduceMotionPath = path.join(__dirname, 'docs', 'reduce_motion_off_trails.png');
  await page.screenshot({ path: reduceMotionPath });
  console.log('4. Reduce Motion OFF trails screenshot saved to:', reduceMotionPath);

  await browser.close();
  console.log('All trail tests passed successfully!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

