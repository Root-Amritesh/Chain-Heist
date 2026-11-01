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

  console.log('Waiting for TitleScene to become active...');
  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('TITLE_SCENE');
  }, { timeout: 15000 });
  console.log('TitleScene is active!');

  console.log('Transitioning to WorldScene at player spawn (960, 576) facing DOWN...');
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

  console.log('Waiting for WorldScene to become active...');
  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('WORLD_SCENE');
  }, { timeout: 10000 });

  await page.waitForTimeout(1500);

  // Take screenshot of world before collect
  const worldBeforePath = path.join(__dirname, 'docs', 'world_coins_tokens.png');
  await page.screenshot({ path: worldBeforePath });
  console.log('Saved world view before collect to:', worldBeforePath);

  // Step down onto coin_7 at (960, 640)
  console.log('Stepping down onto coin_7 at (960, 640)...');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowDown');

  // Wait 350ms (at ~500ms mark, the pop/particles and +10 rising text are clearly visible)
  await page.waitForTimeout(350);
  const coinCollectPath = path.join(__dirname, 'docs', 'coin_collect.png');
  await page.screenshot({ path: coinCollectPath });
  console.log('Coin collect screenshot saved to:', coinCollectPath);

  // Wait for score update and animations to settle
  await page.waitForTimeout(1000);

  // Now test token collection:
  // Move player to (832, 512) facing UP towards token_4 at (832, 448)
  console.log('Repositioning player in front of hidden token_4 at (832, 512)...');
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('WORLD_SCENE');
    if (scene && scene.player) {
      scene.player.sprite.setPosition(832, 512);
      scene.player._targetPosition = { x: 832, y: 512 };
      scene.player._previousTargetPosition = { x: 832, y: 512 };
      scene.player._isMoving = false;
      scene.player._direction = 'UP';
      scene.cameras.main.centerOn(832, 512);
    }
  });

  await page.waitForTimeout(500);

  // Press Space to interact with the hidden token facing UP
  console.log('Pressing Space to interact with token_4...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);

  const tokenFoundPath = path.join(__dirname, 'docs', 'token_found_dialog.png');
  await page.screenshot({ path: tokenFoundPath });
  console.log('Token found dialog screenshot saved to:', tokenFoundPath);

  // Wait for coin to hover, fly to HUD score, and update TOKENS 1/10
  await page.waitForTimeout(1800);
  const tokenCollectedPath = path.join(__dirname, 'docs', 'token_collected_hud.png');
  await page.screenshot({ path: tokenCollectedPath });
  console.log('Token collected HUD screenshot saved to:', tokenCollectedPath);

  await browser.close();
  console.log('All tests completed successfully!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
