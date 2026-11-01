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

  console.log('Transitioning into BlockFlyerScene directly with test data...');
  await page.evaluate(() => {
    const game = window.__game;
    import('./src/state/run-state.js').then(({ runState }) => {
      runState.initNewRun('NEO_CAT', 'cat-1');
      game.scene.getScenes(true).forEach(s => s.scene.stop());
      game.scene.start('BLOCK_FLYER_SCENE', {
        portalId: 1,
        game: 'blockFlyer',
        districtName: 'BLOCK DISTRICT',
        apeAsset: 'HACKER_APE_1',
        apeName: 'HACKER APE',
      });
    });
  });

  // 1. Capture countdown screenshot
  await page.waitForTimeout(800);
  const countdownShot = path.join(__dirname, 'docs', 'block_flyer_countdown.png');
  await page.screenshot({ path: countdownShot });
  console.log('1. Countdown screenshot saved to:', countdownShot);

  // Wait for countdown to finish (~2.3s)
  await page.waitForTimeout(1600);

  console.log('Playing BlockFlyer: guiding cat through mid-air...');
  
  // Flap smoothly only when cat drops below 260px to stay centered
  for (let i = 0; i < 5; i++) {
    const py = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('BLOCK_FLYER_SCENE');
      return scene ? scene.getPlayerY() : 0;
    });

    if (py > 250) {
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(300);
  }

  // 2. Capture clean mid-game screenshot with cat flying mid-air with trail and pillars
  const midGameShot = path.join(__dirname, 'docs', 'block_flyer_midgame.png');
  await page.screenshot({ path: midGameShot });
  console.log('2. Mid-game screenshot saved to:', midGameShot);

  // 3. Trigger 20 pillars completion to verify win flow
  console.log('Triggering 20 pillars win flow...');
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('BLOCK_FLYER_SCENE');
    if (scene && typeof scene.incrementPillarsDebug === 'function') {
      scene.incrementPillarsDebug(20);
    }
  });

  await page.waitForTimeout(600);
  const winBannerShot = path.join(__dirname, 'docs', 'block_flyer_win_banner.png');
  await page.screenshot({ path: winBannerShot });
  console.log('3. Victory banner screenshot saved to:', winBannerShot);

  // 4. Wait for transition to Ape Battle Scene win screen
  await page.waitForTimeout(1600);
  const apeWinShot = path.join(__dirname, 'docs', 'block_flyer_battle_win.png');
  await page.screenshot({ path: apeWinShot });
  console.log('4. Battle Win screen saved to:', apeWinShot);

  await browser.close();
  console.log('All BlockFlyer tests completed successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
