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

  // 1. Title Screen Screenshot
  console.log('Waiting for TitleScene...');
  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('TITLE_SCENE');
  }, { timeout: 15000 });

  await page.waitForTimeout(1200);

  const titlePath = path.join(__dirname, 'docs', 'title_screen_neon.png');
  await page.screenshot({ path: titlePath });
  console.log('Saved Title screen screenshot to:', titlePath);

  // 2. Start game and enter WorldScene
  console.log('Transitioning to WorldScene...');
  await page.evaluate(async () => {
    const { runState } = await import('./src/state/run-state.js');
    runState.initNewRun('NEO', 'cat-1');
    runState.score = 650;
    runState.lives = 3;
    runState.cleared = [1];
    runState.tokensFound = 3;
    runState.save();

    const game = window.__game;
    game.scene.getScenes(true).forEach(s => s.scene.stop());
    game.scene.start('WORLD_SCENE');
  });

  await page.waitForFunction(() => {
    return window.__game && window.__game.scene && window.__game.scene.isActive('WORLD_SCENE');
  }, { timeout: 15000 });

  await page.waitForTimeout(1000);

  // Walk slightly to show player, portals, coins, and trail
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);

  const worldPath = path.join(__dirname, 'docs', 'world_scene_neon.png');
  await page.screenshot({ path: worldPath });
  console.log('Saved World scene screenshot to:', worldPath);

  // 3. Trigger Dialog Box with numbers, highlights, and borders
  console.log('Triggering Dialog modal with numbers and keywords...');
  await page.evaluate(() => {
    const game = window.__game;
    const dialogScene = game.scene.getScene('DIALOG_SCENE');
    dialogScene.showDialogModal([
      'HACKER APE was defeated! NEO secured 600 BIT and found 2 BONUS tokens!'
    ]);
  });

  // Allow text animation to type or complete
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const dialogScene = window.__game.scene.getScene('DIALOG_SCENE');
    if (dialogScene) dialogScene.completeAnimation();
  });
  await page.waitForTimeout(300);

  const dialogPath = path.join(__dirname, 'docs', 'dialog_box_neon.png');
  await page.screenshot({ path: dialogPath });
  console.log('Saved Dialog box screenshot to:', dialogPath);

  // 4. Measure FPS
  const fps = await page.evaluate(() => {
    return window.__game.loop.actualFps;
  });
  console.log('Actual FPS:', Math.round(fps));

  console.log('All screenshots captured successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
