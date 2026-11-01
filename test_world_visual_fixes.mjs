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

  console.log('Transitioning to WorldScene with SATOSHI and cat-1...');
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

  console.log('Waiting for WorldScene...');
  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('WORLD_SCENE');
  }, { timeout: 10000 });

  await page.waitForTimeout(1000);

  // Inspect character sizes and dimensions from game scene
  const inspectData = await page.evaluate(() => {
    const ws = window.__game.scene.getScene('WORLD_SCENE');
    const playerCat = ws['#player']?.catVisual;
    const coins = ws.coins;
    const apes = ws['#hackerApes'];
    const npcs = ws['#npcs'];

    return {
      playerCat: playerCat ? {
        displayWidth: playerCat.displayWidth,
        displayHeight: playerCat.displayHeight,
        scale: playerCat.scaleX,
        originX: playerCat.originX,
        originY: playerCat.originY,
      } : null,
      firstCoin: coins && coins[0] ? {
        containerChildren: coins[0].container.list.length,
        coinWidth: coins[0].container.list[1]?.displayWidth,
        coinHeight: coins[0].container.list[1]?.displayHeight,
        glowRadius: coins[0].container.list[0]?.radius,
        glowAlpha: coins[0].container.list[0]?.alpha,
      } : null,
      firstApe: apes && apes[0] ? {
        width: apes[0].sprite.displayWidth,
        height: apes[0].sprite.displayHeight,
        originY: apes[0].sprite.originY,
      } : null,
      npcsCount: npcs?.length || 0,
    };
  });
  console.log('Inspect data:', JSON.stringify(inspectData, null, 2));

  // 1. Stand next to a coin and take a close-up screenshot of coins next to the cat
  // Player is at (960, 576), coin_7 is at (960, 640), 1 tile down!
  console.log('Taking close-up of coin next to cat...');
  const closeupPath = path.join(__dirname, 'docs', 'cat_coins_closeup.png');
  await page.screenshot({ path: closeupPath });
  console.log('Saved close-up screenshot to:', closeupPath);

  // 2. Start running right along the path towards the portal and capture mid-movement trail
  console.log('Running right to capture mid-movement trail and guide chevrons...');
  await page.keyboard.down('Shift');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200); // mid-step running
  const midMovePath = path.join(__dirname, 'docs', 'cat_movement_trail.png');
  await page.screenshot({ path: midMovePath });
  console.log('Saved mid-movement trail screenshot to:', midMovePath);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Shift');

  await page.waitForTimeout(400);

  // 3. Move down onto coin to test collect
  console.log('Walking down onto coin...');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(180);
  const collectPath = path.join(__dirname, 'docs', 'coin_collect_burst.png');
  await page.screenshot({ path: collectPath });
  console.log('Saved coin collect screenshot to:', collectPath);
  await page.keyboard.up('ArrowDown');

  await page.waitForTimeout(500);

  console.log('Visual tests completed successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
