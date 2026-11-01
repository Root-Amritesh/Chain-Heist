import { WORLD_WIDTH, WORLD_HEIGHT, FEET_BOX_WIDTH, FEET_BOX_HEIGHT } from '../config.js';

/** @type {Uint8Array | null} */
let maskData = null;
let maskW = 0;
let maskH = 0;

/**
 * Initialise the walk-mask from a Phaser texture that was already loaded.
 * Call once in create() after preload finishes.
 * @param {Phaser.Scene} scene
 * @param {string} textureKey  the key used in `this.load.image()`
 */
export function initWalkmask(scene, textureKey = 'WALKMASK') {
  const tex = scene.textures.get(textureKey);
  if (!tex || tex.key === '__MISSING') {
    console.warn('[walkmask] texture not found, generating default all-walkable mask');
    maskW = WORLD_WIDTH;
    maskH = WORLD_HEIGHT;
    maskData = new Uint8Array(maskW * maskH).fill(1);
    return;
  }

  const source = tex.getSourceImage();
  maskW = source.width;
  maskH = source.height;

  // draw to an offscreen canvas to read pixel data
  const canvas = document.createElement('canvas');
  canvas.width = maskW;
  canvas.height = maskH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(/** @type {HTMLImageElement} */ (source), 0, 0);
  const imgData = ctx.getImageData(0, 0, maskW, maskH);

  maskData = new Uint8Array(maskW * maskH);
  for (let i = 0; i < maskW * maskH; i++) {
    // Use red channel: > 127 = walkable, <= 127 = blocked
    maskData[i] = imgData.data[i * 4] > 127 ? 1 : 0;
  }

  console.log(`[walkmask] loaded ${maskW}x${maskH}, walkable pixels: ${maskData.reduce((s, v) => s + v, 0)}`);
  computeFloodFill(590, 480);
  if (typeof window !== 'undefined') {
    /** @type {any} */ (window).__walkmask = { getWalkmaskData, isWalkable, isReachable, getReachableCount };
  }
}

/** @type {Uint8Array | null} */
let reachableData = null;
let lastReachableCount = 0;

/**
 * Compute flood fill from player spawn (590, 480)
 * @param {number} [spawnX=590]
 * @param {number} [spawnY=480]
 * @returns {{ reachableCount: number }}
 */
export function computeFloodFill(spawnX = 590, spawnY = 480) {
  if (!maskData) return { reachableCount: 0 };
  const w = maskW;
  const h = maskH;
  reachableData = new Uint8Array(w * h);

  const sx = Math.floor(spawnX);
  const sy = Math.floor(spawnY);
  if (sx < 0 || sx >= w || sy < 0 || sy >= h || maskData[sy * w + sx] !== 1) {
    console.warn(`[walkmask] Spawn (${spawnX}, ${spawnY}) is not walkable!`);
    return { reachableCount: 0 };
  }

  const queue = new Int32Array(w * h * 2);
  let head = 0;
  let tail = 0;

  queue[tail++] = sx;
  queue[tail++] = sy;
  reachableData[sy * w + sx] = 1;
  let count = 1;

  while (head < tail) {
    const cx = queue[head++];
    const cy = queue[head++];

    const dirs = [
      cx + 1, cy,
      cx - 1, cy,
      cx, cy + 1,
      cx, cy - 1,
    ];

    for (let i = 0; i < 8; i += 2) {
      const nx = dirs[i];
      const ny = dirs[i + 1];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const idx = ny * w + nx;
        if (reachableData[idx] === 0 && maskData[idx] === 1) {
          reachableData[idx] = 1;
          count++;
          queue[tail++] = nx;
          queue[tail++] = ny;
        }
      }
    }
  }

  lastReachableCount = count;
  console.log(`[walkmask] Flood-fill complete from (${spawnX}, ${spawnY}). Total reachable pixels: ${count}`);
  return { reachableCount: count };
}

/**
 * Returns the total count of reachable pixels computed from the last flood-fill
 * @returns {number}
 */
export function getReachableCount() {
  return lastReachableCount;
}

/**
 * Check if a pixel is reachable from the player spawn.
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isReachable(x, y) {
  if (!reachableData) return isWalkable(x, y);
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= maskW || iy >= maskH) return false;
  return reachableData[iy * maskW + ix] === 1;
}

/**
 * Find the nearest reachable pixel to (tx, ty). If (tx, ty) is already reachable, returns it unchanged.
 * If not, performs a BFS outward to locate the closest reachable pixel and logs a warning.
 * @param {number} tx
 * @param {number} ty
 * @param {string} [label='object']
 * @returns {{ x: number, y: number, nudged: boolean }}
 */
export function findNearestReachable(tx, ty, label = 'object') {
  const ix = Math.floor(tx);
  const iy = Math.floor(ty);
  if (isReachable(ix, iy)) {
    return { x: tx, y: ty, nudged: false };
  }

  const w = maskW;
  const h = maskH;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h * 2);
  let head = 0;
  let tail = 0;

  if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
    queue[tail++] = ix;
    queue[tail++] = iy;
    visited[iy * w + ix] = 1;
  }

  let found = null;
  while (head < tail) {
    const cx = queue[head++];
    const cy = queue[head++];

    if (reachableData && reachableData[cy * w + cx] === 1) {
      found = { x: cx, y: cy };
      break;
    }

    const dirs = [
      cx + 1, cy,
      cx - 1, cy,
      cx, cy + 1,
      cx, cy - 1,
    ];

    for (let i = 0; i < 8; i += 2) {
      const nx = dirs[i];
      const ny = dirs[i + 1];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const idx = ny * w + nx;
        if (visited[idx] === 0) {
          visited[idx] = 1;
          queue[tail++] = nx;
          queue[tail++] = ny;
        }
      }
    }
  }

  if (found) {
    console.warn(`[walkmask] Nudged unreachable ${label} from (${tx}, ${ty}) to nearest reachable (${found.x}, ${found.y})`);
    return { x: found.x, y: found.y, nudged: true };
  }

  return { x: tx, y: ty, nudged: false };
}

/**
 * Check if a single pixel is walkable.
 * @param {number} x  world-space x in map pixels
 * @param {number} y  world-space y in map pixels
 * @returns {boolean}
 */
export function isWalkable(x, y) {
  if (!maskData) return true; // mask not loaded yet — allow movement
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= maskW || iy >= maskH) return false;
  return maskData[iy * maskW + ix] === 1;
}

/**
 * Test whether a feet-box rectangle is fully walkable.
 * @param {number} cx  centre-x of the feet box
 * @param {number} cy  centre-y of the feet box
 * @param {number} [hw]  half-width  (defaults to FEET_BOX_WIDTH/2)
 * @param {number} [hh]  half-height (defaults to FEET_BOX_HEIGHT/2)
 * @returns {boolean}
 */
export function isFeetBoxWalkable(cx, cy, hw = FEET_BOX_WIDTH / 2, hh = FEET_BOX_HEIGHT / 2) {
  // Sample corners + centre of the feet box
  const x0 = cx - hw;
  const x1 = cx + hw;
  const y0 = cy - hh;
  const y1 = cy + hh;

  return (
    isWalkable(x0, y0) &&
    isWalkable(x1, y0) &&
    isWalkable(x0, y1) &&
    isWalkable(x1, y1) &&
    isWalkable(cx, cy)
  );
}

/**
 * Try to move from (ox, oy) by (dx, dy). Resolve X and Y separately so the player
 * slides along walls instead of stopping dead. Uses sub-stepping to prevent tunnelling.
 * @param {number} ox  current x
 * @param {number} oy  current y
 * @param {number} dx  desired delta x
 * @param {number} dy  desired delta y
 * @param {number} [hw]  half-width of feet box
 * @param {number} [hh]  half-height of feet box
 * @returns {{ x: number, y: number }}  the resolved position
 */
export function resolveMovement(ox, oy, dx, dy, hw = FEET_BOX_WIDTH / 2, hh = FEET_BOX_HEIGHT / 2) {
  const MAX_STEP = 2; // max pixels per sub-step to prevent tunnelling
  let rx = ox;
  let ry = oy;

  // Resolve X axis
  if (dx !== 0) {
    const steps = Math.ceil(Math.abs(dx) / MAX_STEP);
    const stepSize = dx / steps;
    for (let i = 0; i < steps; i++) {
      const nx = rx + stepSize;
      if (isFeetBoxWalkable(nx, ry, hw, hh)) {
        rx = nx;
      } else {
        break; // hit a wall on X
      }
    }
  }

  // Resolve Y axis
  if (dy !== 0) {
    const steps = Math.ceil(Math.abs(dy) / MAX_STEP);
    const stepSize = dy / steps;
    for (let i = 0; i < steps; i++) {
      const ny = ry + stepSize;
      if (isFeetBoxWalkable(rx, ny, hw, hh)) {
        ry = ny;
      } else {
        break; // hit a wall on Y
      }
    }
  }

  return { x: rx, y: ry };
}

/**
 * Get the raw mask data for debug rendering.
 * @returns {{ data: Uint8Array | null, width: number, height: number }}
 */
export function getWalkmaskData() {
  return { data: maskData, width: maskW, height: maskH };
}

/**
 * Paint a circle on the walkmask (for the in-game editor).
 * @param {number} cx  center X in map pixels
 * @param {number} cy  center Y in map pixels
 * @param {number} radius  brush radius in pixels
 * @param {boolean} walkable  true = paint walkable, false = paint blocked
 */
export function paintWalkmask(cx, cy, radius, walkable) {
  if (!maskData) return;
  const val = walkable ? 1 : 0;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(maskW - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(maskH - 1, Math.ceil(cy + radius));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const ddx = px - cx;
      const ddy = py - cy;
      if (ddx * ddx + ddy * ddy <= r2) {
        maskData[py * maskW + px] = val;
      }
    }
  }
}

/**
 * Export the walkmask as a PNG data URL for saving.
 * @returns {string}  data:image/png;base64,...
 */
export function exportWalkmaskPNG() {
  if (!maskData) return '';
  const canvas = document.createElement('canvas');
  canvas.width = maskW;
  canvas.height = maskH;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(maskW, maskH);
  for (let i = 0; i < maskW * maskH; i++) {
    const v = maskData[i] === 1 ? 255 : 0;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

