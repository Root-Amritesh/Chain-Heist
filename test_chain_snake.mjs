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

  console.log(`Navigating to game at ${gameUrl} ...`);
  await page.goto(gameUrl);

  await page.waitForTimeout(1500);

  console.log('Transitioning into ChainSnakeScene directly with test data...');
  await page.evaluate(() => {
    const game = window.__game;
    import('./src/state/run-state.js').then(({ runState }) => {
      runState.initNewRun('NEO_CAT', 'cat-1');
      game.scene.getScenes(true).forEach(s => s.scene.stop());
      game.scene.start('CHAIN_SNAKE_SCENE', {
        portalId: 3,
        game: 'chainSnake',
        districtName: 'CHAIN DISTRICT',
        apeAsset: 'HACKER_APE_3',
        apeName: 'HACKER APE',
      });
    });
  });

  // Capture Countdown
  await page.waitForTimeout(800);
  const countdownShotPath = path.join(__dirname, 'docs', 'chain_snake_countdown.png');
  await page.screenshot({ path: countdownShotPath });
  console.log('1. Countdown screenshot saved to:', countdownShotPath);

  // Wait for countdown to conclude (3, 2, 1, LINK CHAIN! -> ~2.8s total)
  await page.waitForTimeout(2500);

  console.log('Playing ChainSnake: steering cat snake and collecting blocks...');

  // Steer snake downwards
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);

  // Add a few packets and gold coin + malware to show rich mid-game state
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('CHAIN_SNAKE_SCENE');
    if (scene) {
      // Collect 8 blocks to show speedup, blocks progress 8/15, and spawn wandering malware
      for (let i = 0; i < 8; i++) {
        scene.collectPacketDebug();
      }
      scene.triggerGoldCoinDebug();
    }
  });

  // Steer right and up
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(350);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);

  // Capture rich mid-game screenshot
  const midGameShotPath = path.join(__dirname, 'docs', 'chain_snake_midgame.png');
  await page.screenshot({ path: midGameShotPath });
  console.log('2. Mid-game screenshot saved to:', midGameShotPath);

  // Collect until 15 blocks to test Win transition
  console.log('Collecting blocks up to 15 to test Win flow...');
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('CHAIN_SNAKE_SCENE');
    if (scene) {
      for (let i = 0; i < 7; i++) {
        scene.collectPacketDebug();
      }
    }
  });

  // Wait for Win banner and ApeBattleScene transition
  await page.waitForTimeout(700);
  const winBannerShotPath = path.join(__dirname, 'docs', 'chain_snake_win_banner.png');
  await page.screenshot({ path: winBannerShotPath });
  console.log('3. Win banner screenshot saved to:', winBannerShotPath);

  // Wait for Ape Battle Scene win screen
  await page.waitForTimeout(1600);
  const winApeShotPath = path.join(__dirname, 'docs', 'chain_snake_battle_win.png');
  await page.screenshot({ path: winApeShotPath });
  console.log('4. Battle Win screen saved to:', winApeShotPath);

  await browser.close();
  console.log('All tests completed successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
