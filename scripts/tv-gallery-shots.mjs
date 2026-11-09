#!/usr/bin/env node
/**
 * Screenshots every scene of the dev Cambio TV gallery (/dev/cambio-host) at 6 and 12 seats,
 * catching each big moment while it's on screen. Fails if the page logs an error.
 *
 *   node scripts/tv-gallery-shots.mjs [--url http://localhost:5273] [--size 1920x1080]
 *     [--out .claude/c5-screenshots/gallery] [--only 12]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:5273');
const [width, height] = arg('size', '1920x1080').split('x').map(Number);
const out = arg('out', '.claude/c5-screenshots/gallery');
const only = arg('only', null);
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });

/** What to wait for in each scene before the shot; the rest are shot once they settle. */
const MOMENTS = {
  'Peek (own)': '[data-testid=peek-marker]',
  'Peek (other)': '[data-testid=peek-marker]',
  'King peek and swap': '[data-testid=peek-marker]',
  Snap: '[data-testid=snap-callout]',
  'Snap and give': '[data-testid=snap-callout]',
  'Chained snaps': '[data-testid=snap-callout][data-chain="3"]',
  'Wrong snap (own)': '[data-testid=wrong-snap-callout]',
  'Wrong snap (other)': '[data-testid=wrong-snap-callout]',
  Reshuffle: '[data-testid=reshuffle-label]',
  'Cambio called, caller locked': '[data-testid=cambio-banner][data-docked=false]',
  'Cambio called': '[data-testid=cambio-banner][data-docked=false]',
  'Round end': '[data-testid=reveal-tally]',
  'Match round end': '[data-testid=reveal-tally]',
  'Game over': '[data-testid=reveal-tally]',
};
/** A second shot once these scenes settle: the docked banner, the standings. */
const AFTER = {
  'Cambio called, caller locked': '[data-testid=cambio-banner][data-docked=true]',
  'Round end': '[data-testid=standings]',
  'Match round end': '[data-testid=standings]',
  'Game over': '[data-testid=standings]',
};
/** Moments caught mid-flight: a short pause so the motion lands in the frame. */
const SETTLE = { 'Chained snaps': 480, Snap: 480, 'Snap and give': 480 };

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const errors = [];
let labels = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
      errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico'))
      errors.push(`http ${r.status()}: ${r.url()}`);
  });
  await page.goto(`${base}/dev/cambio-host`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('main section a', { timeout: 15_000 });
  labels = await page.$$eval('main section:first-of-type a', (as) =>
    as.map((a) => a.textContent.trim()),
  );
  for (const n of only ? [Number(only)] : [6, 12]) {
    for (const [i, label] of labels.entries()) {
      const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-$/, '');
      const file = (suffix = '') =>
        join(out, `${n}p-${String(i).padStart(2, '0')}-${slug}${suffix}-${width}x${height}.png`);
      await page.goto(`${base}/dev/cambio-host?scene=${i}&n=${n}`, { waitUntil: 'networkidle0' });
      const moment = MOMENTS[label];
      if (moment) {
        await page.waitForSelector(moment, { timeout: 15_000 }).catch(() => {
          errors.push(`${n}p ${label}: ${moment} never showed`);
        });
        await sleep(SETTLE[label] ?? 120);
      } else {
        await page.waitForSelector('[data-gallery-done]', { timeout: 15_000 });
        await page.waitForSelector('[data-testid=cambio-tv][data-step=idle]', { timeout: 15_000 });
        await sleep(500);
      }
      await page.screenshot({ path: file() });
      console.log('shot', file());
      if (AFTER[label]) {
        await page.waitForSelector(AFTER[label], { timeout: 20_000 }).catch(() => {
          errors.push(`${n}p ${label}: ${AFTER[label]} never showed`);
        });
        await sleep(700);
        await page.screenshot({ path: file('-after') });
        console.log('shot', file('-after'));
      }
    }
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(`FAILED\n${[...new Set(errors)].join('\n')}`);
  process.exit(1);
}
if (!labels.length) {
  console.error('FAILED: no scenes found');
  process.exit(1);
}
console.log('ok, no console errors');
