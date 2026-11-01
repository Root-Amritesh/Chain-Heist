// @ts-nocheck
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('Generating comprehensive neo-city-foreground.png ...');
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
    const srcCanvas = /** @type {any} */ (document.getElementById('srcCanvas'));
    /** @type {HTMLCanvasElement} */
    const fgCanvas = /** @type {any} */ (document.getElementById('fgCanvas'));
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

    function copyRect(x1, y1, x2, y2) {
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          copyPixel(x, y);
        }
      }
    }

    // 1. Giant Cyber Tree Canopy (top center, hanging over the clearing)
    copyRect(650, 0, 950, 320);

    // 2. Green Umbrella Trees: all 7 trees canopy pixels
    const treeRegions = [
      { x1: 960, y1: 50, x2: 1100, y2: 170 },
      { x1: 1350, y1: 50, x2: 1480, y2: 170 },
      { x1: 630, y1: 400, x2: 770, y2: 510 },
      { x1: 630, y1: 560, x2: 770, y2: 670 },
      { x1: 630, y1: 720, x2: 770, y2: 830 },
      { x1: 630, y1: 880, x2: 770, y2: 990 },
      { x1: 1360, y1: 880, x2: 1490, y2: 990 },
    ];

    treeRegions.forEach(reg => {
      for (let y = reg.y1; y <= reg.y2; y++) {
        for (let x = reg.x1; x <= reg.x2; x++) {
          const idx = (y * 1920 + x) * 4;
          const r = s[idx], g = s[idx + 1], b = s[idx + 2];
          const isGreen = (g > 100 && g > r * 1.1 && g > b * 1.1) ||
                          (g > 140 && r > 100 && b < 160 && g >= r);
          const isCanopyShade = (y < reg.y2 - 20) && (g > 70 && g >= b);
          if (isGreen || isCanopyShade) {
            copyPixel(x, y);
            copyPixel(x + 1, y);
            copyPixel(x, y + 1);
          }
        }
      }
    });

    // 3. Overhead Horizontal Pipeline & Girders (crossing cols 35..90, y: 440..485)
    copyRect(520, 440, 1440, 485);

    // 4. City District Rooftops, Overhangs, Chimneys & Awnings
    copyRect(0, 0, 400, 260);        // North building roofs & antennae
    copyRect(200, 390, 400, 460);    // TEK SHOP neon awning & overhang
    copyRect(80, 480, 410, 680);     // Central market building rooftop & chimneys
    copyRect(260, 580, 390, 640);    // Market stall awnings
    copyRect(0, 680, 280, 750);      // Mid awning
    copyRect(0, 820, 420, 1152);     // South residential roofs & chimneys

    // 5. Refinery Cooling Towers Tops, Vents & Elevated Girders
    copyRect(1040, 0, 1920, 240);    // Cooling tower rims & holographic emitters
    copyRect(1080, 220, 1800, 320);  // Elevated conduit bridges
    copyRect(960, 330, 1450, 370);   // Elevated hazard gantries

    fCtx.putImageData(fgData, 0, 0);
    return fgCanvas.toDataURL('image/png');
  }, imgBase64);

  const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
  const outPath = path.resolve('assets/images/bithunter/maps/neo-city-foreground.png');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log('Saved comprehensive foreground layer to:', outPath, 'size:', fs.statSync(outPath).size);

  await browser.close();
})();
