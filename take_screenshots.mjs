// @ts-nocheck
import { chromium } from 'playwright';
import path from 'path';
import { getGameUrl } from './test-helpers.mjs';

(async () => {
  const gameUrl = await getGameUrl();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log(`Navigating to game on ${gameUrl} ...`);
  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  
  // Clear localStorage to ensure clean new game
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const canvas = page.locator('canvas');

  // 1. Title Screen
  console.log('Waiting for Title Scene to render...');
  await page.waitForTimeout(3500);
  
  const titlePath = path.resolve('docs/title_screen.png');
  await canvas.screenshot({ path: titlePath });
  console.log('1. Title screen captured to:', titlePath);

  // Click on "New Game" and press Space
  console.log('Selecting New Game...');
  await canvas.click({ position: { x: 512, y: 340 } });
  await page.waitForTimeout(150);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');

  // 2. Hunter Choice Screen
  console.log('Waiting for Hunter Choice Scene...');
  await page.waitForTimeout(2500);

  const hunterPath = path.resolve('docs/hunter_choice.png');
  await canvas.screenshot({ path: hunterPath });
  console.log('2. Hunter Choice screen captured to:', hunterPath);

  // Confirm chosen cat unit -> Name Input Scene
  console.log('Confirming hunter unit...');
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');

  // 3. Name Input Screen
  console.log('Waiting for Name Input Scene...');
  await page.waitForTimeout(2500);

  const namePath = path.resolve('docs/name_screen.png');
  await canvas.screenshot({ path: namePath });
  console.log('3. Name screen captured to:', namePath);

  // Confirm Name -> Intro Scene
  console.log('Confirming name...');
  await page.keyboard.down('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.up('Enter');

  // 4. Intro Scene with Prof. Ledger
  console.log('Waiting for Intro Scene with Prof. Ledger...');
  await page.waitForTimeout(3000);

  const introPath = path.resolve('docs/intro_screen.png');
  await canvas.screenshot({ path: introPath });
  console.log('4. Intro screen captured to:', introPath);

  // Advance through dialogue slides to enter World Scene
  console.log('Advancing dialogue pages...');
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(700);
    await page.keyboard.down('Space');
    await page.waitForTimeout(100);
    await page.keyboard.up('Space');
    await page.waitForTimeout(700);
    await page.keyboard.down('Space');
    await page.waitForTimeout(100);
    await page.keyboard.up('Space');
  }

  // 5. World Scene with Portals and Hacker Apes
  console.log('Waiting for World Scene to render with portals, glowing neon rings, and Hacker Apes...');
  await page.waitForTimeout(3500);

  const worldPortalsPath = path.resolve('docs/world_portals_and_apes.png');
  await canvas.screenshot({ path: worldPortalsPath });
  console.log('5. World Portals and Hacker Apes captured to:', worldPortalsPath);

  const hudPath = path.resolve('docs/world_hud.png');
  await canvas.screenshot({ path: hudPath });

  // 6. Test Hacker Ape Encounter & Battle Sequence
  console.log('Triggering Hacker Ape battle intro...');
  await page.evaluate(() => {
    const game = window.__game;
    const ws = game.scene.getScene('WORLD_SCENE');
    if (ws) {
      ws.scene.start('APE_BATTLE_SCENE', {
        mode: 'intro',
        portalId: 1,
        game: 'blockFlyer',
        districtName: 'BLOCK DISTRICT',
        apeAsset: 'HACKER_APE_1',
        apeName: 'HACKER APE',
      });
    }
  });
  await page.waitForTimeout(1500);

  const battleIntroPath = path.resolve('docs/ape_battle_intro.png');
  await canvas.screenshot({ path: battleIntroPath });
  console.log('6. Battle Intro captured to:', battleIntroPath);

  // Advance from battle intro to mini-game
  console.log('Advancing to Mini-Game placeholder (Block Flyer)...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);

  const miniGamePath = path.resolve('docs/minigame_placeholder.png');
  await canvas.screenshot({ path: miniGamePath });
  console.log('7. Mini-Game placeholder captured to:', miniGamePath);

  // Test [W] key (WIN)
  console.log('Pressing [W] to simulate victory...');
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(1500);

  const battleWinPath = path.resolve('docs/ape_battle_win.png');
  await canvas.screenshot({ path: battleWinPath });
  console.log('8. Battle Win Screen captured to:', battleWinPath);

  // Advance messages to return to world with rewards
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(2000);

  const clearedWorldPath = path.resolve('docs/world_portal_cleared.png');
  await canvas.screenshot({ path: clearedWorldPath });
  console.log('9. Cleared World & HUD update captured to:', clearedWorldPath);

  // Test [L] key (LOSE) on District 2
  console.log('Testing Mini-Game Defeat [L] on Vault Run...');
  await page.evaluate(() => {
    const game = window.__game;
    const ws = game.scene.getScene('WORLD_SCENE');
    if (ws) {
      ws.scene.start('VAULT_RUN_SCENE', {
        portalId: 2,
        game: 'vaultRun',
        districtName: 'VAULT DISTRICT',
        apeAsset: 'HACKER_APE_2',
        apeName: 'HACKER APE',
      });
    }
  });
  await page.waitForTimeout(1500);

  // Press [L]
  console.log('Pressing [L] to simulate loss...');
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(1500);

  const battleLosePath = path.resolve('docs/ape_battle_lose.png');
  await canvas.screenshot({ path: battleLosePath });
  console.log('10. Battle Lose Screen captured to:', battleLosePath);

  // Advance message to return to world
  await page.keyboard.press('Space');
  await page.waitForTimeout(2000);

  // 11. Results Scene
  console.log('Testing Results Scene display...');
  await page.evaluate(() => {
    const game = window.__game;
    const ws = game.scene.getScene('WORLD_SCENE');
    if (ws) {
      ws.scene.start('RESULTS_SCENE');
    }
  });
  await page.waitForTimeout(1500);

  const resultsPath = path.resolve('docs/results_scene.png');
  await canvas.screenshot({ path: resultsPath });
  console.log('11. Results scene captured to:', resultsPath);

  // 12. Create side-by-side title comparison image
  console.log('Creating Title screen side-by-side comparison image...');
  const compPage = await browser.newPage({ viewport: { width: 1600, height: 600 } });
  
  const fs = await import('fs');
  const origB64 = fs.readFileSync(path.resolve('docs/original_title_screen.png')).toString('base64');
  const newB64 = fs.readFileSync(path.resolve('docs/title_screen.png')).toString('base64');

  await compPage.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            background: #060410;
            color: #FFFFFF;
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
          }
          h2 {
            margin: 6px 0 12px 0;
            font-size: 16px;
            letter-spacing: 1px;
            color: #3FF0FF;
          }
          .row {
            display: flex;
            gap: 20px;
          }
          .card {
            border: 2px solid #3FF0FF;
            background: #0d0922;
            border-radius: 6px;
            overflow: hidden;
            text-align: center;
          }
          .card h3 {
            margin: 8px;
            font-size: 14px;
            color: #FFD700;
          }
          img {
            display: block;
            width: 760px;
            height: 428px;
            object-fit: contain;
            background: #000;
          }
        </style>
      </head>
      <body>
        <h2>TITLE SCREEN VERIFICATION // FIRST COMMIT VS RESTORED CHAIN HEIST</h2>
        <div class="row">
          <div class="card">
            <h3>ORIGINAL (FIRST COMMIT)</h3>
            <img src="data:image/png;base64,${origB64}" />
          </div>
          <div class="card">
            <h3>RESTORED (CHAIN HEIST)</h3>
            <img src="data:image/png;base64,${newB64}" />
          </div>
        </div>
      </body>
    </html>
  `);

  await compPage.waitForTimeout(500);
  const comparisonPath = path.resolve('docs/title_screen_comparison.png');
  await compPage.screenshot({ path: comparisonPath });
  console.log('12. Title comparison image captured to:', comparisonPath);
  await compPage.close();

  await browser.close();
  console.log('All tests and screenshots completed successfully!');
})();
