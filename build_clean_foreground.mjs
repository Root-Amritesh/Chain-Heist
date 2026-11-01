// @ts-nocheck
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('Generating clean, transparent neo-city-foreground.png...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const imgPath = path.resolve('assets/images/bithunter/maps/neo-city.png');
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');

  await page.setContent(`
    <html>
      <body style="margin:0; background:transparent;">
        <canvas id="srcCanvas" width="1920" height="1152"></canvas>
        <canvas id="fgCanvas" width="1920" height="1152"></canvas>
      </body>
    </html>
  `);

  const pngDataUrl = await page.evaluate(async (base64) => {
    /** @type {HTMLCanvasElement} */
    const srcCanvas = document.getElementById('srcCanvas');
    /** @type {HTMLCanvasElement} */
    const fgCanvas = document.getElementById('fgCanvas');
    if (!srcCanvas || !fgCanvas) throw new Error('Canvas not found');

    const sCtx = srcCanvas.getContext('2d');
    const fCtx = fgCanvas.getContext('2d');
    if (!sCtx || !fCtx) throw new Error('Context not available');

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = 'data:image/png;base64,' + base64;
    });

    sCtx.drawImage(img, 0, 0);

    const srcData = sCtx.getImageData(0, 0, 1920, 1152);
    const fgData = fCtx.createImageData(1920, 1152);

    const s = srcData.data;
    const d = fgData.data;

    function copyPixel(x, y) {
      if (x < 0 || x >= 1920 || y < 0 || y >= 1152) return;
      const idx = (y * 1920 + x) * 4;
      d[idx] = s[idx];
      d[idx + 1] = s[idx + 1];
      d[idx + 2] = s[idx + 2];
      d[idx + 3] = s[idx + 3];
    }

    // ONLY copy genuine overhead occluders:
    // 1. Overhead Horizontal Pipe Gantry crossing y: 440..485 across x: 520..1440
    // Only copy pipe metallic/neon pixels, avoid background
    for (let y = 442; y <= 478; y++) {
      for (let x = 520; x <= 1440; x++) {
        const idx = (y * 1920 + x) * 4;
        const r = s[idx], g = s[idx + 1], b = s[idx + 2];
        // The pipe has distinct blue/gray/purple metal tones or highlight
        // Exclude dark background pixels if any
        if (r > 30 || g > 30 || b > 40) {
          copyPixel(x, y);
        }
      }
    }

    // 2. Umbrella tree foliage canopies (7 trees)
    const treeRegions = [
      { x1: 960, y1: 50, x2: 1100, y2: 160 },
      { x1: 1350, y1: 50, x2: 1480, y2: 160 },
      { x1: 630, y1: 400, x2: 770, y2: 500 },
      { x1: 630, y1: 560, x2: 770, y2: 660 },
      { x1: 630, y1: 720, x2: 770, y2: 820 },
      { x1: 630, y1: 880, x2: 770, y2: 980 },
      { x1: 1360, y1: 880, x2: 1490, y2: 980 },
    ];

    treeRegions.forEach(reg => {
      for (let y = reg.y1; y <= reg.y2; y++) {
        for (let x = reg.x1; x <= reg.x2; x++) {
          const idx = (y * 1920 + x) * 4;
          const r = s[idx], g = s[idx + 1], b = s[idx + 2];
          // Green foliage tones
          const isGreen = (g > 100 && g > r * 1.1 && g > b * 1.1) ||
                          (g > 130 && r > 90 && b < 160 && g >= r);
          if (isGreen) {
            copyPixel(x, y);
          }
        }
      }
    });

    // 3. Cyber tree canopy foliage (top center, y: 0..260, x: 700..920)
    for (let y = 0; y <= 260; y++) {
      for (let x = 700; x <= 920; x++) {
        const idx = (y * 1920 + x) * 4;
        const r = s[idx], g = s[idx + 1], b = s[idx + 2];
        const isFoliage = (b > 110 && g > 90) || (g > 120 && g > r);
        if (isFoliage) {
          copyPixel(x, y);
        }
      }
    }

    fCtx.putImageData(fgData, 0, 0);
    return fgCanvas.toDataURL('image/png');
  }, imgBase64);

  const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
  const outPath = path.resolve('assets/images/bithunter/maps/neo-city-foreground.png');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log('Saved clean foreground layer to:', outPath, 'size:', fs.statSync(outPath).size);

  await browser.close();
})();

