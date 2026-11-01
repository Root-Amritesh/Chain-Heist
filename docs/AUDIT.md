# Chain Heist: Complete Engine & Performance Audit

**Audit Date:** 2026-11-01  
**Target:** Chain Heist (Bit-Hunter 2099)  
**Status:** Phase 1 Complete (Read-Only Audit, 0 Code Mutations)

---

## 1. Phaser Game Configuration

Located in `src/main.js`:
```javascript
const game = new Phaser.Game({
  type: Phaser.AUTO,
  pixelArt: true,
  scale: {
    parent: 'game-container',
    width: 1024,
    height: 576,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#000000',
});
```

### Deficiencies Identified:
1. **Missing `roundPixels: true`**: Sprite coordinates are allowed sub-pixel floating values, causing texture shimmering and blurry edge artifacts on moving sprites and the camera.
2. **Missing `fps` Configuration**: No `{ target: 60, forceSetTimeOut: false }` specified. High-refresh-rate displays (120 Hz, 144 Hz) drive Phaser at 120–144 ticks/second, causing game speed to double or triple.
3. **Missing `powerPreference: 'high-performance'`**: GPU defaults to low-power integrated throttle on dual-GPU laptops.
4. **Missing `antialias: false`**: WebGL texture filtering can blend pixel art when antialias is not explicitly disabled at the renderer level.

---

## 2. Update Loops & Frame-Rate Independence (`delta` vs Fixed Amounts)

| Scene | `update()` Signature | Uses `delta`? | Description / Movement Type | Issue / Impact |
| :--- | :--- | :--- | :--- | :--- |
| **`BlockFlyerScene`** | `update(time, delta)` | ❌ **NO** | `vy += gravity` (0.30/frame), `y += vy`<br>`cityScrollX -= speed * 0.35`<br>`groundScrollX -= speed` | Runs at **2.4x speed** on 144 Hz monitors! Player drops and flies twice as fast. Extreme unfair difficulty. |
| **`VaultRunScene`** | `update(time, delta)` | ⚠️ **PARTIAL** | Frightened timer uses `delta`.<br>Player: `x += dirX * 2.0`<br>Apes: `x += dirX * ape.speed` (fixed px/frame) | Player & Ape movement is locked to per-frame increments (`2.0 px/frame`). 144 Hz screens move the characters at 288 px/s instead of 120 px/s! |
| **`ChainSnakeScene`** | `update(time)` | ⚠️ **PARTIAL** | `if (time >= lastTickTime + interval)` (accumulated `time`) | Step logic is tick-based, but countdown timer relied on scene timer event without delta clamping, and malware tile stepped at variable rates. |
| **`WorldScene`** | `update(time)` | ❌ **NO** | `super.update(time)` | Character movement uses tween duration (`300 ms` run / `600 ms` walk), but guide chevron waves, radar pulses, afterimages, and particle drifts rely on real clock time or per-frame increments. |
| **`Player` / `Character`** | `update(time)` | ❌ **NO** | Grid tween duration (`600 ms` walk, `300 ms` run) | Too slow for responsive gameplay (600 ms feels sluggish). Target should be 180 ms walk / 110 ms run. |
| **`ResultsScene`** | `update(time, delta)` | ❌ **NO** | Badge 3D orbit: `currentAngle = item.baseAngle + time * 0.0022` | Orbit angle increments on `time`, but tween count-ups don't clamp large delta spikes. |
| **`LeaderboardScene`** | `update()` | ❌ **NO** | Key checking only | Clean, but no input lock guarding during transition. |

---

## 3. PostFX / PreFX, Emitters, Looping Tweens & Object Allocations

### A. PostFX / PreFX
- **Individual Coins (`world-scene.js:1120`)**: `sprite.postFX.addGlow(0xFFD700, 2, 0, false, 0.1, 8)` is applied to **each individual coin sprite**. 30+ separate WebGL postFX shaders executing simultaneously! Primary cause of mobile and integrated GPU frame drops.
- **Portals (`world-scene.js:951`)**: `ringContainer.postFX.addGlow(ringColor, 3, 1, false, 0.1, 12)` on 3 portals.
- **Player Sprite (`world-scene.js:2259`)**: `this.#player.sprite.postFX.addGlow(0x3FF0FF, 2, 0, false, 0.1, 8)`.
- **Camera (`world-scene.js:2244`)**: `this.cameras.main.postFX.addColorMatrix()`.

### B. Particle Emitters & Runtime Allocations
- **World Cat Trail (`world-scene.js:1620`)**:
  - `this.add.image(...)` is called **every 40–60 ms** while moving to create afterimages, which are then destroyed via `ghost.destroy()`. **Garbage collection churn!**
  - Emitter `trail-pixel-2x2` emits continuous particles.
- **World Ambient Particles (`world-scene.js:2273`)**: `this.add.particles(0, 0, 'neon-mote', { maxAliveParticles: 25 })`.
- **Block Flyer Ribbon Trail (`block-flyer-scene.js:428`)**:
  - Array of `{x, y, vx, vy, ...}` objects instantiated per frame into `#btcParticles`.
  - Multi-segment polygon ribbon generated from scratch every frame with `this.#trailGraphics.fillPath()` over 36 history points.
- **Vault Run Trail (`vault-run-scene.js:175`)**: Array of trail objects pushed and filtered every frame; Graphics redrawn every frame.

### C. Looping Tweens (`repeat: -1` / `loop: true`)
- **World Scene**:
  - 30 coins × 2 tweens each (glow scale + container bob) = **60 concurrent looping tweens**.
  - 3 portals × 3 looping tweens each (outer glow pulse + rotating ring segment + floating label) = **9 looping tweens**.
  - 8 guide path chevrons × 1 looping pulse each = **8 looping tweens**.
  - Minimap radar pulse + player dot blink = **2 looping tweens**.
  - Big map radar pulse + player dot blink = **2 looping tweens**.
  - **Total: ~81 active looping tweens** running in WorldScene simultaneously, even when objects are off-screen!

### D. Scene Lifecycle & Cleanup Leaks
- Scenes lacked comprehensive `scene.events.once('shutdown', ...)` handlers.
- When entering a mini-game (`BlockFlyer`, `VaultRun`, `ChainSnake`) from `WorldScene`, world tweens, delayed calls, and keyboard event listeners remained active in memory.

---

## 4. Asset Loading & Preload Flow

### Current Architecture:
- Assets are defined in `src/assets/asset-keys.js` and `src/assets/bithunter-asset-keys.js`.
- Loaded in `src/scenes/preload-scene.js` via `preload()`.
- **Issues Found**:
  1. **No Visual Progress Bar**: `PreloadScene` renders nothing to the screen during loading; shows a black screen with no percentage indicator.
  2. **Font Loading Race Condition**: `WebFontFileLoader` loads `Kenney-Future-Narrow.ttf`, but `PreloadScene.create()` calls `this.scene.start(SCENE_KEYS.TITLE_SCENE)` **without awaiting `document.fonts.ready`**. If the TTF hasn't rasterized, fallback canvas fonts flash or text metrics calculate with width 0.
  3. **Mini-game Scene Entry**: Countdown timers begin, but input listeners were bound immediately in `create()` rather than after the 3-2-1 countdown finished.

---

## 5. Map Bounds, Camera Bounds & Collision Limits

### Current Metrics:
- **Tiled Data (`neo-city.json`)**:
  - Map width: 120 tiles (at 16 px = 1920 px)
  - Map height: 72 tiles (at 16 px = 1152 px)
- **Engine Spec Target**:
  - World Map Size: **3840 × 2304 px** (**60 × 36 tiles of 64 px**).
  - TILE_SIZE: `64 px`.
- **Bound Vulnerabilities**:
  1. `CameraUtils.updateMainCameraBounds` relies on `cameraRegions` layer from Tiled. If missing or misaligned, camera bounds fail or leave black screen borders.
  2. Outer border tiles (row 0, row 35, col 0, col 59) lack an explicit hard-coded boundary check in `character.js` / `world-scene.js`. If a tile is unpainted in the collision layer, the player can walk off into the void.
  3. Spawn coordinates: Player position loaded from data store or default lacks an automatic walkable tile validation / fallback resolver.

---

## 6. Action Plan for Subsequent Phases

1. **Phase 2**: Standardize `Phaser.AUTO`, `fps.target = 60`, `roundPixels: true`, and enforce `delta` multiplication on all physics/movement variables with a 50 ms max delta clamp. Add F2 FPS counter.
2. **Phase 3**: Strip per-object postFX glow. Generate a single 64×64 soft radial gradient glow canvas texture at boot, attached via pooled sprites with `BlendModes.ADD`. Pool afterimages and coins. Cull off-screen updates.
3. **Phase 4**: Set world & camera bounds strictly to 3840×2304 px (60×36 tiles of 64 px) with lerp 0.1 and outer perimeter collision clamping. Walk and screenshot 4 corners.
4. **Phase 5**: Add cyberpunk "LOADING CHAIN… [xx%]" progress bar in `PreloadScene`. Await `document.fonts.ready`. Enforce 3-2-1 countdown lock in mini-games.
5. **Phase 6**: Centralize mini-game tuning into `src/config/minigames-config.js` with all exact physics, speeds, and timers specified. Add 1s pause + "CHAIN BROKEN" on death, and global ESC pause.
6. **Phase 7**: Smooth 180 ms walk / 110 ms run tile tweens. Pixel-crisp text. Sound volume normalization.
7. **Phase 8**: 3 complete verification runs, FPS benchmarks, zero console errors.

