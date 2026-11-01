// @ts-nocheck
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const W = 1920;
const H = 1152;

(async () => {
  console.log('Generating authentic restricted neo-city-walkmask.png...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const mapData = JSON.parse(fs.readFileSync('assets/data/neo-city.json', 'utf8'));

  await page.setContent(`
    <html>
    <body style="margin:0; background:transparent;">
      <canvas id="c" width="${W}" height="${H}"></canvas>
    </body>
    </html>
  `);

  const dataUrl = await page.evaluate(({ W, H, mapData }) => {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');

    // 1. DEFAULT IS BLOCKED (Solid Black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    function walk(x, y, w, h) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
    }
    function block(x, y, w, h) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
    }
    function walkCircle(cx, cy, r) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    function blockCircle(cx, cy, r) {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. EXPLICITLY MARK VALID PATHWAYS & ROADS AS WALKABLE

    // --- City District (Left Side) ---
    // The Great East-West Cyberpunk Avenue (row of coins, connects across entire city)
    walk(48, 565, 1680, 85);

    // Upper City Street (in front of TEK SHOP & shops)
    walk(48, 415, 390, 65);

    // Far-Left North-South Street
    walk(48, 190, 50, 860);

    // Data Hub Street (vertical between buildings)
    walk(275, 190, 65, 860);

    // Alleys connecting far-left and Data Hub street
    walk(80, 220, 210, 50);

    // City Market Plaza (pedestrian area around stalls)
    walk(85, 470, 340, 290);

    // Pink pedestrian lane (bottom-left)
    walk(48, 760, 95, 360);

    // Connector to Chain Snake portal
    walk(140, 880, 220, 95);

    // Bottom City street
    walk(48, 1020, 370, 85);

    // --- Central Jungle & Nature Trail ---
    // North-South Dirt Trail
    walk(520, 280, 100, 180);
    walk(430, 415, 190, 65);  // Junction connecting Upper City Street to dirt trail
    walk(430, 565, 190, 85);  // Junction connecting Main Avenue to dirt trail
    walk(450, 640, 170, 190); // Lower dirt trail

    // Designated Walkable Bush & Grass terrain
    walk(460, 320, 180, 110); // Upper designated grass meadow
    walk(440, 710, 190, 140); // Lower designated grass meadow
    walk(880, 520, 160, 150); // Grassy clearing around player spawn point

    // --- Industrial / Wasteland / Refinery Zone ---
    // Yellow-Black Hazard Striped Walkway under cooling towers
    walk(610, 350, 570, 65);

    // Connector between Main Avenue and Hazard Walkway
    walk(610, 410, 70, 160);

    // Elevated Walkway near cooling towers
    walk(1120, 180, 520, 60);

    // Vertical conduit link
    walk(1120, 235, 65, 125);

    // Pipe Gantry Passage (narrow walking path under pipes)
    walk(690, 520, 430, 50);

    // Block Flyer portal area (top-right)
    walk(1480, 170, 180, 100);

    // --- Scrapyard & Rock Pit (Floor Only) ---
    // Dirt Floor through bottom of rock pit
    walk(840, 610, 220, 140);
    // Scrapyard path
    walk(850, 745, 290, 105);

    // --- Docks & Container Yard (Bottom Right) ---
    // Container Yard walkways
    walk(1180, 420, 320, 75);
    walk(1180, 490, 80, 360);
    walk(1250, 780, 240, 75);

    // Pier / Dock wooden walkway
    walk(1340, 680, 340, 75);
    walk(1540, 750, 160, 110);

    // Vault Run portal platform
    walk(1560, 910, 150, 120);

    // 3. CARVE OUT SOLID OBSTACLES & FOOTPRINTS (BLACK)

    // Outer Map Perimeter (solid border)
    block(0, 0, W, 18);
    block(0, H - 18, W, 18);
    block(0, 0, 18, H);
    block(W - 18, 0, 18, H);

    // Building Footprints & Rooftops (Solid - cannot enter or walk on roofs!)
    block(98, 270, 175, 140);   // Building 1 (between alleys)
    block(48, 48, 230, 140);    // Northwest building
    block(340, 48, 180, 140);   // North-center building
    block(340, 250, 170, 160);  // Highrise structure
    block(0, 650, 48, 200);     // West wall
    block(0, 850, 48, 270);     // Southwest building

    // Market stalls solid table counters (players walk around, not through!)
    block(140, 520, 50, 45);
    block(280, 650, 95, 45);

    // Dense Cyber Tree trunk & solid thickets
    block(730, 110, 130, 150);
    block(680, 40, 80, 240);

    // Heavy Machinery & Cooling Tower Bases
    block(1230, 40, 130, 135);
    block(1410, 40, 130, 135);
    block(1590, 40, 130, 135);
    block(780, 180, 180, 160);

    // Steep Rock Pit Perimeter Walls (Cliff faces are blocked)
    block(750, 570, 85, 270);   // West rock ridge
    block(1065, 605, 95, 140);  // East rock ridge

    // Scrap & Rubble pile inside pit
    block(860, 680, 80, 60);

    // TOXIC GREEN POOL (Blocked!)
    block(990, 830, 180, 130);

    // WATER / OCEAN (Blocked!)
    block(1680, 755, 240, 397); // Water basin
    block(1380, 855, 170, 297); // Dock inlet water
    block(1700, 870, 180, 110); // Patrol boat

    // Shipping Containers in Yard
    block(1270, 495, 180, 120);
    block(1300, 620, 150, 55);
    block(1460, 490, 150, 90);

    // 4. GUARANTEE ALL COLLECTIBLES, SPAWN, AND NPCS ARE WALKABLE
    walkCircle(960, 640, 36); // Spawn

    mapData.layers.find(l => l.name === 'Coins')?.objects?.forEach(c => {
      walkCircle(c.x + 32, c.y + 32, 24);
    });

    mapData.layers.find(l => l.name === 'Tokens')?.objects?.forEach(t => {
      walkCircle(t.x + 32, t.y + 32, 24);
    });

    mapData.layers.find(l => l.name === 'Portals')?.objects?.forEach(p => {
      const cx = p.x + (p.width ? p.width / 2 : 32);
      const cy = p.y + (p.height ? p.height / 2 : 32);
      walkCircle(cx, cy, 36);
      walkCircle(cx - 64, cy, 28);
      walkCircle(cx + 64, cy, 28);
    });

    mapData.layers.find(l => l.name === 'NPC')?.layers?.forEach(g => {
      g.objects?.forEach(npc => {
        walkCircle(npc.x + 32, npc.y + 32, 28);
      });
    });

    return canvas.toDataURL('image/png');
  }, { W, H, mapData });

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const outPath = path.resolve('assets/images/bithunter/maps/neo-city-walkmask.png');
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  console.log(`Generated authentic restricted neo-city-walkmask.png at ${outPath}`);

  await browser.close();
})();
