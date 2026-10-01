// Measures logo A in Chromium with the real font: the label, the emblem, the
// chevrons and where every letter stands on its baseline. outline.py turns
// the result into themes/kaffeeroesterei/logo.svg.
// Usage: node tools/logo/measure.mjs <AlfaSlabOne-Regular.ttf> > layout.json
import { chromium } from '@playwright/test';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const font = process.argv[2];
if (!font) throw new Error('usage: node tools/logo/measure.mjs <font.ttf>');
const work = mkdtempSync(join(tmpdir(), 'logo-'));
copyFileSync(fileURLToPath(new URL('label.html', import.meta.url)), join(work, 'label.html'));
copyFileSync(font, join(work, 'font.ttf'));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 400 } });
  await page.goto(`file://${join(work, 'label.html')}`);
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check("96px 'Alfa Slab One'")))) throw new Error('the font did not load');
  const layout = await page.evaluate(() => {
    const card = document.getElementById('card').getBoundingClientRect();
    const box = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.x - card.x, y: r.y - card.y, w: r.width, h: r.height };
    };
    const line = (id) => {
      const holder = document.getElementById(id);
      const text = holder.querySelector('.t').firstChild;
      const letters = [...text.data].map((letter, i) => {
        const range = document.createRange();
        range.setStart(text, i);
        range.setEnd(text, i + 1);
        return { letter, x: range.getBoundingClientRect().x - card.x };
      });
      const baseline = holder.querySelector('.mark').getBoundingClientRect().y - card.y;
      return { letters, baseline, fontSize: parseFloat(getComputedStyle(holder).fontSize) };
    };
    return { em: 96, width: card.width, height: card.height, emblem: box('emblem'), chevrons: box('chevrons'), lines: [line('line1'), line('line2')] };
  });
  process.stdout.write(`${JSON.stringify(layout, null, 1)}\n`);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
