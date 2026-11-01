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

  console.log('Transitioning into VaultRunScene directly with test data...');
  await page.evaluate(() => {
    const game = window.__game;
    import('./src/state/run-state.js').then(({ runState }) => {
      runState.initNewRun('NEO_CAT', 'cat-1');
      game.scene.getScenes(true).forEach(s => s.scene.stop());
      game.scene.start('VAULT_RUN_SCENE', {
        portalId: 2,
        game: 'vaultRun',
        districtName: 'VAULT DISTRICT',
        apeAsset: 'HACKER_APE_2',
        apeName: 'HACKER APE',
      });
    });
  });

  // 1. Capture countdown screenshot
  await page.waitForTimeout(800);
  const countdownShot = path.join(__dirname, 'docs', 'vault_run_countdown.png');
  await page.screenshot({ path: countdownShot });
  console.log('1. Countdown screenshot saved to:', countdownShot);

  // Wait for countdown to finish (~2.3s)
  await page.waitForTimeout(1800);

  console.log('Playing VaultRun: steering cat, eating pellets, triggering power mode...');

  // Steer cat along the bottom corridor
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);

  // Trigger frightened mode to show blue vulnerable apes and active gameplay
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('VAULT_RUN_SCENE');
    if (scene && typeof scene.triggerFrightenedDebug === 'function') {
      scene.triggerFrightenedDebug();
    }
  });

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);

  // 2. Capture mid-game screenshot
  const midGameShot = path.join(__dirname, 'docs', 'vault_run_midgame.png');
  await page.screenshot({ path: midGameShot });
  console.log('2. Mid-game screenshot saved to:', midGameShot);

  // 3. Trigger Win flow by eating remaining pellets
  console.log('Triggering all pellets eaten win flow...');
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('VAULT_RUN_SCENE');
    if (scene && typeof scene.eatAllPelletsDebug === 'function') {
      scene.eatAllPelletsDebug();
    }
  });

  await page.waitForTimeout(500);
  const winBannerShot = path.join(__dirname, 'docs', 'vault_run_win_banner.png');
  await page.screenshot({ path: winBannerShot });
  console.log('3. Victory banner screenshot saved to:', winBannerShot);

  // 4. Wait for transition to Ape Battle Scene win screen
  await page.waitForTimeout(1600);
  const apeWinShot = path.join(__dirname, 'docs', 'vault_run_battle_win.png');
  await page.screenshot({ path: apeWinShot });
  console.log('4. Battle Win screen saved to:', apeWinShot);

  await browser.close();
  console.log('All VaultRun tests completed successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});

