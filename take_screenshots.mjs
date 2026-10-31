import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Wait 4 seconds for assets and fonts to load and title scene to render
  await page.waitForTimeout(4000);
  
  const titlePath = path.resolve('docs/title_screen.png');
  await page.screenshot({ path: titlePath });
  console.log('Title screen captured to:', titlePath);

  // Press SPACE to start / proceed to WorldScene
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const worldPath = path.resolve('docs/world_scene.png');
  await page.screenshot({ path: worldPath });
  console.log('World scene captured to:', worldPath);

  await browser.close();
})();

