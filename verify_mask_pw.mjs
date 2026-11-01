// @ts-nocheck
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const maskBase64 = fs.readFileSync('assets/images/bithunter/maps/neo-city-walkmask.png').toString('base64');
  const mapData = JSON.parse(fs.readFileSync('assets/data/neo-city.json', 'utf8'));

  await page.setContent(`
    <html>
    <body>
      <canvas id="c" width="1920" height="1152"></canvas>
      <img id="m" src="data:image/png;base64,${maskBase64}" />
    </body>
    </html>
  `);

  const report = await page.evaluate((mapData) => {
    const canvas = document.getElementById('c');
    const img = document.getElementById('m');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, 1920, 1152);

    function isWalkable(x, y) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      if (ix < 0 || iy < 0 || ix >= 1920 || iy >= 1152) return false;
      const idx = (iy * 1920 + ix) * 4;
      return imgData.data[idx] > 128;
    }

    // Total walkable pixels
    let walkableCount = 0;
    for (let i = 0; i < 1920 * 1152; i++) {
      if (imgData.data[i * 4] > 128) walkableCount++;
    }
    const walkablePercent = ((walkableCount / (1920 * 1152)) * 100).toFixed(1);

    const spawnLayer = mapData.layers.find(l => l.name.toLowerCase().includes('player-spawn'));
    const spawnObj = spawnLayer?.objects[0];
    const spawnWalkable = spawnObj ? isWalkable(spawnObj.x, spawnObj.y) : false;

    const portalsLayer = mapData.layers.find(l => l.name === 'Portals');
    const portals = portalsLayer?.objects.map(p => {
      const cx = p.x + (p.width ? p.width / 2 : 32);
      const cy = p.y + (p.height ? p.height / 2 : 32);
      return { name: p.name, cx, cy, walkable: isWalkable(cx, cy) };
    });

    const coinsLayer = mapData.layers.find(l => l.name === 'Coins');
    let unwalkableCoins = 0;
    const coins = coinsLayer?.objects.map((c, idx) => {
      const cx = c.x + 32;
      const cy = c.y + 32;
      const w = isWalkable(cx, cy);
      if (!w) unwalkableCoins++;
      return { idx, cx, cy, walkable: w };
    });

    const tokensLayer = mapData.layers.find(l => l.name === 'Tokens');
    let unwalkableTokens = 0;
    const tokens = tokensLayer?.objects.map((t, idx) => {
      const cx = t.x + 32;
      const cy = t.y + 32;
      const w = isWalkable(cx, cy);
      if (!w) unwalkableTokens++;
      return { idx, cx, cy, walkable: w };
    });

    const npcGroup = mapData.layers.find(l => l.name === 'NPC');
    let unwalkableNpcs = 0;
    const npcs = [];
    npcGroup?.layers?.forEach(g => {
      g.objects.forEach(npc => {
        const w = isWalkable(npc.x + 32, npc.y + 32);
        if (!w) unwalkableNpcs++;
        npcs.push({ name: npc.name, x: npc.x + 32, y: npc.y + 32, walkable: w });
      });
    });

    return {
      walkablePercent,
      spawn: { x: spawnObj?.x, y: spawnObj?.y, walkable: spawnWalkable },
      portals,
      totalCoins: coins?.length || 0,
      unwalkableCoins,
      unwalkableCoinList: coins?.filter(c => !c.walkable),
      totalTokens: tokens?.length || 0,
      unwalkableTokens,
      unwalkableTokenList: tokens?.filter(t => !t.walkable),
      totalNpcs: npcs.length,
      unwalkableNpcs,
      unwalkableNpcList: npcs.filter(n => !n.walkable),
    };
  }, mapData);

  console.log('Reachability report:');
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
})();
