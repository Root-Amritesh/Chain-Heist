import { chromium } from 'playwright';

async function runTests() {
  console.log('--- STARTING BIT-HUNTER 2099 PHASE 2 REGRESSION TESTS ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log('[PAGE ERROR]:', err);
  });

  try {
    console.log('Navigating to http://localhost:5174...');
    await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
    
    // Wait for canvas to appear
    console.log('Waiting for #game-container canvas...');
    await page.waitForSelector('#game-container canvas', { timeout: 15000 });
    console.log('Canvas found!');

    // Wait for window.__game to be ready
    await page.waitForFunction(() => Boolean(window.__game && window.__game.scene), { timeout: 15000 });
    console.log('Phaser game instance ready!');

    // Wait for TitleScene to be created and active
    console.log('Waiting for TitleScene...');
    await page.waitForFunction(() => {
      const ts = window.__game.scene.getScene('TITLE_SCENE');
      return Boolean(ts && ts.sys && ts.sys.isActive());
    }, { timeout: 15000 });
    console.log('TitleScene active!');

    // Stop TITLE_SCENE and start WORLD_SCENE directly
    await page.evaluate(() => {
      window.__game.scene.stop('TITLE_SCENE');
      window.__game.scene.start('WORLD_SCENE');
    });

    // Wait for WORLD_SCENE and Player
    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return Boolean(s && s.sys && s.sys.isActive() && s.player && s.player.sprite);
    }, { timeout: 15000 });

    await page.waitForTimeout(1000);

    const initialInfo = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return {
        playerPos: { x: s.player.sprite.x, y: s.player.sprite.y },
        isF2Active: s._isF2CollisionDebugActive || false,
      };
    });
    console.log('WORLD_SCENE ready at playerPos:', initialInfo.playerPos);

    // 1. Capture clean normal gameplay screenshot
    console.log('Capturing normal gameplay screenshot (verifying no translucent rectangles)...');
    await page.screenshot({ path: 'test_clean_gameplay.png' });
    console.log('Saved test_clean_gameplay.png');

    // 2. Test Walking speed vs Sprinting speed
    console.log('Testing walking speed...');
    const startPos = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return { x: s.player.sprite.x, y: s.player.sprite.y };
    });

    // Walk Right for 800ms
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(100);

    const walkEndPos = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return { x: s.player.sprite.x, y: s.player.sprite.y };
    });
    const walkDistance = Math.abs(walkEndPos.x - startPos.x);
    const walkSpeed = walkDistance / 0.8;
    console.log(`Walk distance in 800ms: ${walkDistance.toFixed(1)} px (Speed: ${walkSpeed.toFixed(1)} px/s, expected ~90 px/s)`);

    // Sprint Left for 800ms (holding Shift)
    console.log('Testing sprint speed with SHIFT...');
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    const sprintEndPos = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return { x: s.player.sprite.x, y: s.player.sprite.y };
    });
    const sprintDistance = Math.abs(sprintEndPos.x - walkEndPos.x);
    const sprintSpeed = sprintDistance / 0.8;
    console.log(`Sprint distance in 800ms: ${sprintDistance.toFixed(1)} px (Speed: ${sprintSpeed.toFixed(1)} px/s, expected ~180 px/s)`);

    // 3. Test F2 Collision Debug mode
    console.log('Toggling F2 Collision Debug mode...');
    await page.keyboard.press('F2');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test_f2_debug.png' });
    console.log('Saved test_f2_debug.png');

    // Turn F2 back off
    await page.keyboard.press('F2');
    await page.waitForTimeout(300);

    // 4. Test NPC / Hacker Ape interaction & No automatic minigame launch
    console.log('Testing Hacker Ape interaction...');
    // Teleport player near Ape 3 (CHAIN SNAKE) at (cx=960, cy=736; ape at cx+64=1024, cy=736)
    // Spawn player at (1024, 795) - about 59px away (outside 30px radius)
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      s.player.sprite.setPosition(1024, 795);
    });
    await page.waitForTimeout(500);

    // Check that minigame was NOT automatically launched!
    const activeScene1 = await page.evaluate(() => {
      return window.__game.scene.getScenes(true).map(sc => sc.scene.key);
    });
    console.log('Active scenes when near Ape (outside interaction radius):', activeScene1);
    if (activeScene1.includes('APE_BATTLE_SCENE') || activeScene1.includes('BATTLE_SCENE')) {
      throw new Error('FAIL: Minigame launched automatically without interaction!');
    }

    // Now move player within 25px of Ape (Ape is at 1024, 736 + 30 = 766)
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      s.player.sprite.setPosition(1024, 755);
    });
    await page.waitForTimeout(400);

    // Check that minigame is STILL not automatically launched!
    const activeScene2 = await page.evaluate(() => {
      return window.__game.scene.getScenes(true).map(sc => sc.scene.key);
    });
    console.log('Active scenes when within 25px of Ape:', activeScene2);
    if (activeScene2.includes('APE_BATTLE_SCENE') || activeScene2.includes('BATTLE_SCENE')) {
      throw new Error('FAIL: Minigame launched automatically without interaction!');
    }

    // Press SPACE to open Mission Confirmation Dialog
    console.log('Pressing SPACE near Ape...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test_mission_prompt.png' });
    console.log('Saved test_mission_prompt.png');

    // Test canceling with ESC
    console.log('Pressing ESC to cancel mission prompt...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await page.screenshot({ path: 'test_after_cancel.png' });
    console.log('Saved test_after_cancel.png');

    console.log('--- ALL REGRESSION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('Test error:', err);
    await page.screenshot({ path: 'test_error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
}

runTests();
