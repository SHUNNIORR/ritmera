// Captura la app Ritmera (servidor local) para la landing.
// Uso: node landing/capture.mjs [http://localhost:4201]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4201';
const OUT = new URL('./assets/img/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const DAY = 86_400_000;

async function seedHistory(page) {
  await page.evaluate(async (DAY) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('intervala-db');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = (store) => new Promise(res => {
      const q = db.transaction(store).objectStore(store).getAll();
      q.onsuccess = () => res(q.result);
    });
    if ((await all('history')).length) return;
    const routines = await all('routines');
    const tx = db.transaction('history', 'readwrite');
    const plan = [[0, 0, 'completed'], [1, 1, 'completed'], [3, 2, 'interrupted'], [0, 4, 'completed'], [2, 6, 'completed']];
    const now = Date.now();
    plan.forEach(([ri, daysAgo, status], i) => {
      const r = routines[ri % routines.length];
      const steps = r.blocks.reduce((n, b) => n + b.steps.length * b.repetitions, 0);
      const planned = { 'HIIT 40/20': 460, 'Tabata clásico': 230, 'Pomodoro': 6900, 'EMOM 10 min': 600 }[r.name] ?? 600;
      const start = now - daysAgo * DAY - (i + 2) * 3_600_000;
      const done = status === 'completed' ? steps : Math.ceil(steps / 2);
      tx.objectStore('history').add({
        id: 'seed-' + i, sessionId: 'seed-s-' + i, routineId: r.id, routineName: r.name,
        routineSnapshot: { id: r.id, name: r.name, category: r.category, color: r.color, blocks: r.blocks },
        startedAt: start, endedAt: start + planned * 1000 * (done / steps),
        plannedDurationSec: planned, actualDurationMs: planned * 1000 * (done / steps) + 4000,
        stepsCompleted: done, totalSteps: steps, status, schemaVersion: 1,
      });
    });
    await new Promise(res => (tx.oncomplete = res));
  }, DAY);
}

async function routineIds(page) {
  return page.evaluate(async () => {
    const db = await new Promise(res => { const r = indexedDB.open('intervala-db'); r.onsuccess = () => res(r.result); });
    return new Promise(res => {
      const q = db.transaction('routines').objectStore('routines').getAll();
      q.onsuccess = () => res(Object.fromEntries(q.result.map(r => [r.name, r.id])));
    });
  });
}

async function shot(page, name, width) {
  const png = await page.screenshot();
  await sharp(png).resize({ width }).webp({ quality: 82 }).toFile(OUT + name + '.webp');
  console.log('saved', name);
}

const browser = await chromium.launch();
for (const [mode, ctxOpts, w] of [
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, 2400],
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 780],
]) {
  const ctx = await browser.newContext({ ...ctxOpts, colorScheme: 'dark', locale: 'es-ES' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/biblioteca');
  await page.waitForSelector('.routine-card');
  await seedHistory(page);
  const ids = await routineIds(page);
  console.log(mode, Object.keys(ids));

  await page.reload(); await page.waitForSelector('.routine-card'); await page.waitForTimeout(600);
  await shot(page, `${mode}-library`, w);

  const tabata = Object.entries(ids).find(([n]) => n.startsWith('Tabata'))?.[1];
  await page.goto(`${BASE}/rutina/${tabata}/editar`); await page.waitForTimeout(1200);
  await shot(page, `${mode}-editor`, w);

  const hiit = Object.entries(ids).find(([n]) => n.startsWith('HIIT'))?.[1];
  await page.goto(`${BASE}/temporizador/${hiit}`); await page.waitForTimeout(6500);
  await shot(page, `${mode}-timer`, w);
  await page.click('.play-pause-btn'); // pausa para que no siga corriendo

  await page.goto(BASE + '/historial'); await page.waitForTimeout(1000);
  await shot(page, `${mode}-history`, w);
  await ctx.close();
}
await browser.close();
