import { chromium } from 'playwright';

async function runVerification() {
  console.log('=== STARTING COMPLETE STEP 1-5 VERIFICATION ===');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[BROWSER]: ${text}`);
  });

  page.on('pageerror', err => {
    console.error('[BROWSER ERROR]:', err);
  });

  try {
    console.log('1. Connecting to http://localhost:5174...');
    await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-container canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      const ts = window.__game?.scene?.getScene('TITLE_SCENE');
      return Boolean(ts && ts.sys && ts.sys.isActive());
    }, { timeout: 15000 });

    // Transition to WORLD_SCENE after preload is complete
    await page.evaluate(() => {
      window.__game.scene.stop('TITLE_SCENE');
      window.__game.scene.start('WORLD_SCENE');
    });

    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return Boolean(s && s.sys && s.sys.isActive() && s.player && s.player.sprite);
    }, { timeout: 15000 });

    await page.waitForTimeout(1000);

    // ==========================================
    // STEP 1 VERIFICATION: KILL OVERLAY LAYER & UI DEPTH
    // ==========================================
    console.log('\n--- VERIFYING STEP 1: KILL OVERLAY LAYER ---');
    const step1Audit = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      const spanningObjects = [];
      let fgFound = false;
      let ambientRectFound = false;

      s.children.list.forEach((child) => {
        const w = child.width || child.displayWidth || 0;
        const h = child.height || child.displayHeight || 0;
        if (w >= 1000 || h >= 1000 || child.isTilemapLayer) {
          const key = child.texture?.key || child.name || child.type || 'N/A';
          if (key.includes('foreground') || key.includes('FOREGROUND')) fgFound = true;
          if (child.type === 'Rectangle' && (child.blendMode === 3 || child.blendMode === 2)) ambientRectFound = true;
          spanningObjects.push({
            type: child.type,
            key,
            depth: child.depth,
            alpha: child.alpha !== undefined ? child.alpha : 1,
            tint: child.tintTopLeft !== undefined ? `0x${child.tintTopLeft.toString(16)}` : 'NONE',
            blendMode: child.blendMode,
            visible: child.visible,
          });
        }
      });

      // Minimap metrics
      const minimap = s.children.list.find(c => c.type === 'Container' && c.depth >= 1000000 && c.x === 808);
      const hud = s.children.list.find(c => c.type === 'Container' && c.depth >= 1000000 && c.x === 16);

      return {
        spanningCount: spanningObjects.length,
        spanningObjects,
        fgFound,
        ambientRectFound,
        minimapFound: Boolean(minimap),
        minimapPos: minimap ? { x: minimap.x, y: minimap.y, depth: minimap.depth } : null,
        hudFound: Boolean(hud),
        hudDepth: hud ? hud.depth : null,
      };
    });

    console.log('Map spanning objects found:', step1Audit.spanningCount);
    console.log(JSON.stringify(step1Audit.spanningObjects, null, 2));
    console.log('Foreground layer present:', step1Audit.fgFound);
    console.log('Ambient dark overlay rectangle present:', step1Audit.ambientRectFound);
    console.log('Minimap positioned correctly (808, 14, depth >= 1,000,000):', step1Audit.minimapPos);
    console.log('HUD depth >= 1,000,000:', step1Audit.hudDepth);

    if (step1Audit.fgFound) throw new Error('FAIL: Foreground layer is still rendering!');
    if (step1Audit.ambientRectFound) throw new Error('FAIL: Ambient overlay rectangle is still present!');
    if (!step1Audit.minimapFound || step1Audit.minimapPos.depth < 1000000) throw new Error('FAIL: Minimap depth/position incorrect!');

    await page.screenshot({ path: 'test_clean_gameplay.png' });
    console.log('Saved test_clean_gameplay.png');

    // ==========================================
    // STEP 2 VERIFICATION: SINGLE COLLISION SOURCE & REACHABILITY
    // ==========================================
    console.log('\n--- VERIFYING STEP 2: SINGLE COLLISION SOURCE & REACHABILITY ---');
    const step2Audit = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      const { getWalkmaskData, isWalkable, isReachable, getReachableCount } = window.__walkmask;
      const { data, width, height } = getWalkmaskData();

      const pPos = { x: s.player.sprite.x, y: s.player.sprite.y };
      const spawnWalkable = isWalkable(pPos.x, pPos.y);
      const spawnReachable = isReachable(pPos.x, pPos.y);

      // Check all coins
      const coinsReport = s.coins?.map((c, i) => ({
        id: i + 1,
        x: c.x,
        y: c.y,
        walkable: isWalkable(c.x, c.y),
        reachable: isReachable(c.x, c.y),
      })) || [];

      // Check all tokens
      const tokensReport = s.tokens?.map((t, i) => ({
        id: i + 1,
        x: t.centerX,
        y: t.centerY,
        walkable: isWalkable(t.centerX, t.centerY),
        reachable: isReachable(t.centerX, t.centerY),
      })) || [];

      // Check all portals
      const portalsReport = s.portals?.map((p) => ({
        id: p.id,
        label: p.label,
        cx: p.cx,
        cy: p.cy,
        walkable: isWalkable(p.cx, p.cy),
        reachable: isReachable(p.cx, p.cy),
      })) || [];

      // Check all hacker apes
      const apesReport = s.hackerApes?.map((a) => ({
        label: a.label,
        x: a.sprite.x,
        y: a.sprite.y,
        walkable: isWalkable(a.sprite.x, a.sprite.y),
        reachable: isReachable(a.sprite.x, a.sprite.y),
      })) || [];

      // Check regular npcs
      const npcsReport = s.npcs?.map((n, i) => ({
        id: i + 1,
        x: n.sprite.x,
        y: n.sprite.y,
        walkable: isWalkable(n.sprite.x, n.sprite.y),
        reachable: isReachable(n.sprite.x, n.sprite.y),
      })) || [];

      const unreachableCoins = coinsReport.filter(c => !c.reachable).length;
      const unreachableTokens = tokensReport.filter(t => !t.reachable).length;
      const unreachablePortals = portalsReport.filter(p => !p.reachable).length;
      const unreachableApes = apesReport.filter(a => !a.reachable).length;
      const unreachableNpcs = npcsReport.filter(n => !n.reachable).length;
      const totalUnreachable = unreachableCoins + unreachableTokens + unreachablePortals + unreachableApes + unreachableNpcs;

      return {
        maskDimensions: { width, height },
        playerPos: pPos,
        spawnWalkable,
        spawnReachable,
        reachablePixelsCount: getReachableCount(),
        coinsTotal: coinsReport.length,
        unreachableCoins,
        tokensTotal: tokensReport.length,
        unreachableTokens,
        portalsTotal: portalsReport.length,
        unreachablePortals,
        apesTotal: apesReport.length,
        unreachableApes,
        npcsTotal: npcsReport.length,
        unreachableNpcs,
        totalUnreachable,
      };
    });

    console.log('Walkmask dimensions:', step2Audit.maskDimensions);
    console.log('Player spawn position:', step2Audit.playerPos, 'Walkable:', step2Audit.spawnWalkable, 'Reachable:', step2Audit.spawnReachable);
    console.log('Total reachable pixels flood-filled from spawn:', step2Audit.reachablePixelsCount);
    console.log(`Coins: ${step2Audit.coinsTotal} (Unreachable: ${step2Audit.unreachableCoins})`);
    console.log(`Tokens: ${step2Audit.tokensTotal} (Unreachable: ${step2Audit.unreachableTokens})`);
    console.log(`Portals: ${step2Audit.portalsTotal} (Unreachable: ${step2Audit.unreachablePortals})`);
    console.log(`Hacker Apes: ${step2Audit.apesTotal} (Unreachable: ${step2Audit.unreachableApes})`);
    console.log(`NPCs: ${step2Audit.npcsTotal} (Unreachable: ${step2Audit.unreachableNpcs})`);
    console.log(`TOTAL UNREACHABLE OBJECTS: ${step2Audit.totalUnreachable}`);

    if (step2Audit.totalUnreachable !== 0) {
      throw new Error(`FAIL: Found ${step2Audit.totalUnreachable} unreachable objects! Must be 0.`);
    }

    // Test F1 and F2 keys
    console.log('Testing F1 Debug overlay toggle...');
    await page.keyboard.press('F1');
    await page.waitForTimeout(300);
    const f1Visible = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s.isF1DebugActive && s.collisionDebugGfx?.visible;
    });
    console.log('F1 overlay visible:', f1Visible);
    await page.screenshot({ path: 'test_f1_overlay.png' });
    await page.keyboard.press('F1'); // Toggle off

    console.log('Testing F2 Walkmask Editor toggle...');
    await page.keyboard.press('F2');
    await page.waitForTimeout(300);
    const f2Active = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s.isF2EditorActive;
    });
    console.log('F2 editor active:', f2Active);
    await page.screenshot({ path: 'test_f2_editor.png' });
    await page.keyboard.press('F2'); // Toggle off

    // ==========================================
    // STEP 3 VERIFICATION: MOVEMENT SPEED (WALK VS SPRINT)
    // ==========================================
    console.log('\n--- VERIFYING STEP 3: MOVEMENT SPEED ---');
    // In-Engine exact 60FPS frame step verification (independent of headless timer throttling)
    const inEngineSpeedTest = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      const startX = 570;
      s.player.sprite.setPosition(startX, 440);

      // Walk 30 frames (0.5s at 60fps)
      for (let i = 0; i < 30; i++) {
        s.player.moveCharacter('RIGHT', false, { x: 1, y: 0 });
        s.player.update(0, 16.6666);
      }
      const walkEndX = s.player.sprite.x;
      const walkDist = walkEndX - startX;
      const walkSpeed = walkDist / 0.5;

      // Sprint 30 frames (0.5s at 60fps)
      for (let i = 0; i < 30; i++) {
        s.player.moveCharacter('RIGHT', true, { x: 1, y: 0 });
        s.player.update(0, 16.6666);
      }
      const sprintEndX = s.player.sprite.x;
      const sprintDist = sprintEndX - walkEndX;
      const sprintSpeed = sprintDist / 0.5;

      return {
        walkSpeed,
        sprintSpeed,
        ratio: sprintSpeed / walkSpeed,
      };
    });

    console.log(`In-Engine 60FPS Walk Speed: ${inEngineSpeedTest.walkSpeed.toFixed(1)} px/s (Expected ~106)`);
    console.log(`In-Engine 60FPS Sprint Speed: ${inEngineSpeedTest.sprintSpeed.toFixed(1)} px/s (Expected ~213)`);
    console.log(`Speed Ratio: ${inEngineSpeedTest.ratio.toFixed(2)}x (Expected ~2.01x)`);

    if (inEngineSpeedTest.walkSpeed < 100 || inEngineSpeedTest.walkSpeed > 112) {
      throw new Error(`FAIL: In-engine walk speed ${inEngineSpeedTest.walkSpeed} px/s out of expected ~106!`);
    }
    if (inEngineSpeedTest.sprintSpeed < 205 || inEngineSpeedTest.sprintSpeed > 220) {
      throw new Error(`FAIL: In-engine sprint speed ${inEngineSpeedTest.sprintSpeed} px/s out of expected ~213!`);
    }
    if (inEngineSpeedTest.ratio < 1.9 || inEngineSpeedTest.ratio > 2.1) {
      throw new Error(`FAIL: Speed ratio ${inEngineSpeedTest.ratio}x not 2x!`);
    }

    // Interactive keyboard input check: verify Shift toggles running state in controls
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      s.player.sprite.setPosition(570, 440);
    });
    await page.waitForTimeout(100);

    await page.keyboard.down('Shift');
    await page.waitForTimeout(50);
    const shiftActive = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s._controls.isShiftKeyDown();
    });
    console.log('Shift key recognized as sprint toggle:', shiftActive);
    await page.keyboard.up('Shift');

    if (!shiftActive) {
      throw new Error('FAIL: Shift key was not detected as sprint modifier!');
    }

    // ==========================================
    // STEP 4 VERIFICATION: NPC-ONLY MINIGAME STARTS & CONFIRMATION DIALOG
    // ==========================================
    console.log('\n--- VERIFYING STEP 4: NPC-ONLY MINIGAME STARTS ---');

    // 1. Move directly over Portal 1 center
    console.log('Testing portal proximity: placing player directly over Portal ring...');
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      const p = s.portals[0];
      s.player.sprite.setPosition(p.cx, p.cy);
    });
    await page.waitForTimeout(600);

    const activeScenesNearPortal = await page.evaluate(() => {
      return window.__game.scene.getScenes(true).map(sc => sc.scene.key);
    });
    console.log('Active scenes when player stands directly on Portal:', activeScenesNearPortal);
    if (activeScenesNearPortal.some(k => k.includes('BATTLE') || k.includes('MINIGAME'))) {
      throw new Error('FAIL: Portal triggered minigame on proximity/overlap! Portals must be visual only.');
    }

    // 2. Approach Chain Snake Hacker Ape (at 352, 958)
    console.log('Approaching Chain Snake Hacker Ape at (352, 958)...');
    const apePos = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      s.player.sprite.setPosition(352, 958);
      const ape = s.hackerApes?.find(a => a.portalId === 3) || s.hackerApes[0];
      return { x: ape.sprite.x, y: ape.sprite.y };
    });
    await page.waitForTimeout(500);

    // Verify [SPACE] TALK indicator is visible
    const talkIndicatorVisible = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s.talkIndicatorContainer?.visible || false;
    });
    console.log('Floating [SPACE] TALK indicator visible:', talkIndicatorVisible);
    if (!talkIndicatorVisible) throw new Error('FAIL: [SPACE] TALK indicator is not visible when near Hacker Ape!');
    await page.screenshot({ path: 'test_talk_indicator.png' });

    // Press SPACE with 150ms hold to open Dialog
    console.log('Pressing SPACE to open Ape Dialog...');
    await page.keyboard.down('Space');
    await page.waitForTimeout(150);
    await page.keyboard.up('Space');
    await page.waitForTimeout(300);

    const dialogState = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return {
        isOpen: s.isMissionPromptOpen,
        depth: s.missionPromptContainer?.depth,
        selectedOption: s.selectedMissionOption,
      };
    });
    console.log('Mission prompt open:', dialogState.isOpen, 'Depth:', dialogState.depth, 'Selected option (0=START, 1=NOT NOW):', dialogState.selectedOption);
    if (!dialogState.isOpen) throw new Error('FAIL: Mission prompt dialog did not open on SPACE!');
    await page.screenshot({ path: 'test_mission_prompt.png' });

    // Verify movement is frozen while dialog is open
    const beforeMovePos = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return { x: s.player.sprite.x, y: s.player.sprite.y };
    });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowDown');

    const afterMovePos = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return { x: s.player.sprite.x, y: s.player.sprite.y };
    });
    const movedWhileOpen = afterMovePos.x !== beforeMovePos.x || afterMovePos.y !== beforeMovePos.y;
    console.log('Player moved while dialog was open:', movedWhileOpen);
    if (movedWhileOpen) throw new Error('FAIL: Player was able to move while mission dialog was open!');

    // Test ArrowDown to select [ NOT NOW ]
    console.log('Selecting option 1 [ NOT NOW ] via ArrowDown...');
    await page.keyboard.press('ArrowDown', { delay: 80 });
    await page.waitForTimeout(200);
    const selectedOpt = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s.selectedMissionOption;
    });
    console.log('Selected option is now:', selectedOpt);
    if (selectedOpt !== 1) throw new Error('FAIL: Option 1 [ NOT NOW ] not selected on ArrowDown!');
    await page.screenshot({ path: 'test_mission_prompt_opt2.png' });

    // Confirm [ NOT NOW ] with Enter
    console.log('Confirming [ NOT NOW ] with Enter...');
    await page.keyboard.press('Enter', { delay: 80 });
    await page.waitForTimeout(300);

    const closedState = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return {
        isOpen: s.isMissionPromptOpen,
        lastDeclineTime: s.lastMissionDeclineTime,
      };
    });
    console.log('Dialog closed:', !closedState.isOpen, 'Cooldown timestamp recorded:', closedState.lastDeclineTime);
    if (closedState.isOpen) throw new Error('FAIL: Dialog did not close on [ NOT NOW ]!');
    await page.screenshot({ path: 'test_after_cancel.png' });

    // Test 1-second cooldown: immediately press SPACE again; should NOT reopen!
    console.log('Testing 1-second cooldown: pressing SPACE immediately...');
    await page.keyboard.press('Space', { delay: 80 });
    await page.waitForTimeout(200);
    const reopenedImmediately = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s.isMissionPromptOpen;
    });
    console.log('Dialog reopened immediately during cooldown:', reopenedImmediately);
    if (reopenedImmediately) throw new Error('FAIL: Dialog reopened immediately without respecting 1-second cooldown!');

    // Wait for cooldown to expire (> 1000ms)
    console.log('Waiting 1100ms for cooldown to expire...');
    await page.waitForTimeout(1100);

    // Press SPACE again; should now open!
    console.log('Pressing SPACE after cooldown...');
    await page.keyboard.press('Space', { delay: 80 });
    await page.waitForTimeout(300);
    const reopenedAfterCooldown = await page.evaluate(() => {
      const s = window.__game.scene.getScene('WORLD_SCENE');
      return s.isMissionPromptOpen;
    });
    console.log('Dialog reopened after cooldown:', reopenedAfterCooldown);
    if (!reopenedAfterCooldown) throw new Error('FAIL: Dialog did not open after 1-second cooldown expired!');

    console.log('\n=== ALL VERIFICATION TESTS PASSED PERFECTLY (STEPS 1 - 4)! ===');
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    await page.screenshot({ path: 'test_error.png' }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runVerification();
