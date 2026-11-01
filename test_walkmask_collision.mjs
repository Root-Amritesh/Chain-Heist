// @ts-nocheck
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { getGameUrl } from './test-helpers.mjs';

(async () => {
  const gameUrl = await getGameUrl();
  console.log(`Connecting to game at ${gameUrl}...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto(gameUrl, { waitUntil: 'networkidle' });

  // Clear storage and start fresh game
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const canvas = page.locator('canvas');
  await page.waitForTimeout(3000);

  // Directly start WORLD_SCENE with default state
  console.log('Starting World Scene directly...');
  await page.evaluate(() => {
    const game = window.__game;
    // ensure cat unit is set
    const dm = game.scene.getScene('PRELOAD_SCENE')?.dataManager || window.__dataManager;
    game.scene.scenes.forEach(s => {
      if (s.scene.key !== 'WORLD_SCENE') {
        game.scene.stop(s.scene.key);
      }
    });
    game.scene.start('WORLD_SCENE');
  });

  await page.waitForTimeout(3500);

  // Verify World Scene is active
  const sceneActive = await page.evaluate(() => {
    const ws = window.__game?.scene?.getScene('WORLD_SCENE');
    return ws && ws.scene.isActive();
  });
  console.log('Is WORLD_SCENE active:', sceneActive);

  // 1. Initial World Scene (Clean view)
  const initialWorldPath = path.resolve('docs/world_walkmask_clean.png');
  await canvas.screenshot({ path: initialWorldPath });
  console.log('1. Captured clean world view to:', initialWorldPath);

  // Get initial player position
  const initialPos = await page.evaluate(() => {
    const ws = window.__game?.scene?.getScene('WORLD_SCENE');
    const p = ws?.player?.sprite;
    return p ? { x: Math.round(p.x), y: Math.round(p.y), depth: Math.round(p.depth) } : null;
  });
  console.log('Initial player position & depth:', initialPos);

  // 2. Press F1 to toggle Walkmask Collision Debug Overlay
  console.log('Toggling F1 Debug Overlay...');
  await page.keyboard.press('F1');
  await page.waitForTimeout(800);

  // Move mouse over canvas to show coordinate tooltip
  await canvas.hover({ position: { x: 300, y: 250 } });
  await page.waitForTimeout(500);

  const debugWorldPath = path.resolve('docs/world_walkmask_f1_debug.png');
  await canvas.screenshot({ path: debugWorldPath });
  console.log('2. Captured F1 collision debug view to:', debugWorldPath);

  // 3. Test Continuous Walking Down
  console.log('Testing continuous walking (holding Down key for 800ms)...');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(300);

  const posAfterDown = await page.evaluate(() => {
    const ws = window.__game?.scene?.getScene('WORLD_SCENE');
    const p = ws?.player?.sprite;
    return p ? { x: Math.round(p.x), y: Math.round(p.y), depth: Math.round(p.depth) } : null;
  });
  console.log('Position & depth after walking Down:', posAfterDown);

  // Test Walking Left (towards city)
  console.log('Testing continuous walking (holding Left key for 800ms)...');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(300);

  const posAfterLeft = await page.evaluate(() => {
    const ws = window.__game?.scene?.getScene('WORLD_SCENE');
    const p = ws?.player?.sprite;
    return p ? { x: Math.round(p.x), y: Math.round(p.y), depth: Math.round(p.depth) } : null;
  });
  console.log('Position & depth after walking Left:', posAfterLeft);

  const walkingWorldPath = path.resolve('docs/world_walkmask_after_move.png');
  await canvas.screenshot({ path: walkingWorldPath });
  console.log('3. Captured world after movement to:', walkingWorldPath);

  // 4. Test F2 Mask Editor
  console.log('Toggling F2 Mask Editor...');
  await page.keyboard.press('F2');
  await page.waitForTimeout(800);

  const editorWorldPath = path.resolve('docs/world_walkmask_f2_editor.png');
  await canvas.screenshot({ path: editorWorldPath });
  console.log('4. Captured F2 mask editor view to:', editorWorldPath);

  // Toggle F2 off and F1 off for final clean test
  await page.keyboard.press('F2');
  await page.waitForTimeout(300);
  await page.keyboard.press('F1');
  await page.waitForTimeout(500);

  const finalCleanPath = path.resolve('docs/world_walkmask_final_clean.png');
  await canvas.screenshot({ path: finalCleanPath });
  console.log('5. Captured final clean gameplay view to:', finalCleanPath);

  await browser.close();
  console.log('All walkmask collision tests completed successfully!');
})();
