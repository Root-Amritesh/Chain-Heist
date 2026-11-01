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

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  console.log(`Navigating to ${gameUrl} ...`);
  await page.goto(gameUrl, { waitUntil: 'networkidle' });

  console.log('Waiting for TitleScene...');
  await page.waitForFunction(
    () => {
      return window.__game && window.__game.scene && window.__game.scene.isActive('TITLE_SCENE');
    },
    { timeout: 15000 },
  );

  // 1. Test VICTORY RUN: All 3 districts cleared
  console.log('Setting up Victory run with all 3 districts cleared...');
  await page.evaluate(async () => {
    localStorage.clear();
    const { runState } = await import('./src/state/run-state.js');
    runState.initNewRun('NEO_CAT', 'cat-1');
    runState.score = 3800;
    runState.cleared = [1, 2, 3];
    runState.lives = 3;
    runState.timeRemaining = 240; // 4 mins left
    runState.tokensFound = 8;
    runState.save();

    const game = window.__game;
    game.scene.getScenes(true).forEach((s) => s.scene.stop());
    game.scene.start('RESULTS_SCENE');
  });

  console.log('Waiting for ResultsScene (Victory)...');
  await page.waitForFunction(
    () => {
      return window.__game && window.__game.scene && window.__game.scene.isActive('RESULTS_SCENE');
    },
    { timeout: 10000 },
  );

  // Wait for score counting animation and spinning badges
  await page.waitForTimeout(1600);

  console.log('Capturing Victory Results Scene screenshot...');
  const resultsVictoryPath = path.join(__dirname, 'docs', 'results_scene_victory.png');
  await page.screenshot({ path: resultsVictoryPath });
  console.log('Saved Victory Results screenshot to:', resultsVictoryPath);

  // 2. Transition to THE LEDGER (Leaderboard)
  console.log('Clicking action button to navigate to THE LEDGER...');
  await page.mouse.click(512, 535);
  await page.waitForTimeout(600);

  console.log('Waiting for LeaderboardScene...');
  await page.waitForFunction(
    () => {
      return window.__game && window.__game.scene && window.__game.scene.isActive('LEADERBOARD_SCENE');
    },
    { timeout: 15000 },
  );

  await page.waitForTimeout(600);

  console.log('Capturing THE LEDGER Leaderboard Scene screenshot...');
  const ledgerPath = path.join(__dirname, 'docs', 'leaderboard_the_ledger.png');
  await page.screenshot({ path: ledgerPath });
  console.log('Saved THE LEDGER screenshot to:', ledgerPath);

  // 3. Press ENTER / click on Leaderboard to verify return to TitleScene for new player
  console.log('Clicking New Player button on Leaderboard to return to Title Scene...');
  await page.mouse.click(512, 510);
  await page.waitForTimeout(800);

  await page.waitForFunction(
    () => {
      return window.__game && window.__game.scene && window.__game.scene.isActive('TITLE_SCENE');
    },
    { timeout: 15000 },
  );
  console.log('Successfully returned to TITLE_SCENE!');

  // 4. Test GAME OVER on Results Scene (e.g. 0 lives or only 1 district cleared)
  console.log('Setting up Game Over run (only 1 district cleared, 0 lives)...');
  await page.evaluate(async () => {
    const { runState } = await import('./src/state/run-state.js');
    runState.initNewRun('GLITCH', 'cat-2');
    runState.score = 1600;
    runState.cleared = [1];
    runState.lives = 0;
    runState.timeRemaining = 0;
    runState.tokensFound = 2;
    runState.save();

    const game = window.__game;
    game.scene.getScenes(true).forEach((s) => s.scene.stop());
    game.scene.start('RESULTS_SCENE');
  });

  await page.waitForTimeout(1000);
  const resultsGameOverPath = path.join(__dirname, 'docs', 'results_scene_gameover.png');
  await page.screenshot({ path: resultsGameOverPath });
  console.log('Saved Game Over Results screenshot to:', resultsGameOverPath);

  console.log('Results and Leaderboard verification finished successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
