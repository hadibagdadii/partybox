#!/usr/bin/env node
/**
 * Plays full bot games on the real TV screen in the installed Chrome (headless) and screenshots
 * the first time each big moment shows up. Fails if the page logs an error.
 *
 *   # a dev server with bots, e.g. the dev-alt-slow-bots launch config
 *   node scripts/tv-playthrough.mjs [--game cambio|diwan] [--bots 5] [--mode single|match]
 *     [--size 1920x1080] [--slowmo 1] [--url http://localhost:5273] [--out .claude/c5-screenshots]
 *     [--minutes 12] [--headed]
 *
 * Only for local dev servers: it uses the host's dev buttons (Add bot, Start).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const game = arg('game', 'cambio');
const base = arg('url', 'http://localhost:5273');
const mode = arg('mode', 'single');
const bots = Number(arg('bots', game === 'diwan' ? '6' : '5'));
const [width, height] = arg('size', '1920x1080').split('x').map(Number);
const slowmo = arg('slowmo', null);
const minutes = Number(arg('minutes', '12'));
const headed = process.argv.includes('--headed');
const tag = `${game}-${bots}bots-${mode}-${width}x${height}`;
const out = join(arg('out', '.claude/c5-screenshots'), game === 'diwan' ? 'diwan' : '');
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome, headless: !headed });
const shots = new Set();
const errors = [];
const log = (...a) => console.log(`[${tag}]`, ...a);

try {
  const tv = await browser.newPage();
  await tv.setViewport({ width, height });
  tv.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  tv.on('console', (m) => {
    if (m.type() !== 'error') return;
    // A failed request is reported once below, with its URL.
    if (m.text().startsWith('Failed to load resource')) return;
    errors.push(`console: ${m.text().slice(0, 400)}`);
  });
  // The dev server has no favicon (a known, harmless 404 on every page).
  tv.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico'))
      errors.push(`http ${r.status()}: ${r.url()}`);
  });
  await tv.goto(`${base}/host${slowmo ? `?slowmo=${slowmo}` : ''}`, { waitUntil: 'networkidle0' });

  const clickText = (text, exact = false) =>
    tv.evaluate(
      (t, ex) => {
        const b = [...document.querySelectorAll('button')].find((x) =>
          ex ? x.textContent.trim() === t : x.textContent.trim().startsWith(t),
        );
        if (!b || b.disabled) return false;
        b.click();
        return true;
      },
      text,
      exact,
    );

  await clickText('Create room');
  await sleep(600);
  await clickText(game === 'diwan' ? 'Diwan' : 'Cambio');
  await sleep(300);
  if (mode === 'match') await clickText('Match', true);
  for (let i = 0; i < bots; i++) {
    await clickText('Add bot');
    await sleep(200);
  }
  // Narration (and Cambio's card sounds) only start from a tap.
  if (!(await clickText(game === 'diwan' ? 'Enable the herald' : 'Turn on narration and sound')))
    log('no herald enable button found');
  await sleep(300);
  await clickText('Start');
  await sleep(1500);

  const shot = async (name, force = false) => {
    if (shots.has(name) && !force) return;
    shots.add(name);
    const file = join(out, `${tag}-${name}.png`);
    await tv.screenshot({ path: file });
    log('shot', file);
  };

  const readCambio = () =>
    tv.evaluate(() => {
      const q = (s) => document.querySelector(s);
      return {
        step: q('[data-testid=cambio-tv]')?.getAttribute('data-step') ?? null,
        drawn: !!q('[data-testid=cambio-tv]')?.getAttribute('data-drawn'),
        peek: !!q('[data-testid=peek-marker]'),
        snap: Number(q('[data-testid=snap-callout]')?.getAttribute('data-chain') ?? 0),
        wrong: !!q('[data-testid=wrong-snap-callout]'),
        banner: q('[data-testid=cambio-banner]')?.getAttribute('data-docked') ?? null,
        reshuffle: !!q('[data-testid=reshuffle-label]'),
        tally: !!q('[data-testid=reveal-tally]'),
        standings: !!q('[data-testid=standings]'),
        over: !!q('[data-testid=standings][data-over]'),
        caption: q('[data-testid=caption]')?.textContent ?? '',
      };
    });

  const readDiwan = () =>
    tv.evaluate(() => ({
      board: !!document.querySelector('[data-testid=track-loyal]'),
      caption: document.querySelector('[data-testid=caption]')?.textContent ?? '',
      votes: !!document.querySelector('[data-testid=vote-cards]'),
      night: !!document.querySelector('[data-testid=night-scene]'),
      over: !!document.querySelector('[data-testid=role-card]'),
    }));

  const started = Date.now();
  const deadline = started + minutes * 60_000;
  let overAt = null;
  while (Date.now() < deadline) {
    await sleep(120);
    if (game === 'diwan') {
      const s = await readDiwan();
      if (s.night) await shot('night');
      if (s.votes) await shot('votes');
      if (s.board && Date.now() - started > 20_000) await shot('board');
      if (s.caption && s.board) await shot('caption');
      if (s.over && !overAt) overAt = Date.now();
    } else {
      const s = await readCambio();
      if (s.drawn) await shot('drawn-card');
      if (s.step && !['idle', 'quiet', 'deal', 'draw'].includes(s.step))
        await shot(`step-${s.step}`);
      if (s.step === 'deal') await shot('deal');
      if (s.peek) await shot('peek-marker');
      if (s.snap >= 1) await shot('snap');
      if (s.snap >= 2) await shot('snap-chain');
      if (s.wrong) await shot('wrong-snap');
      if (s.banner === 'false') await shot('cambio-banner');
      if (s.banner === 'true') await shot('cambio-docked');
      if (s.reshuffle) await shot('reshuffle');
      if (s.tally) await shot('reveal-count');
      if (s.standings && !s.over) await shot('standings');
      if (s.caption) await shot('caption');
      if (s.over && !overAt) overAt = Date.now();
    }
    if (overAt && Date.now() - overAt > 2500) {
      await shot('game-over');
      break;
    }
  }
  if (!overAt) errors.push(`no game over within ${minutes} minutes`);
  log('screenshots:', [...shots].join(', '));
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`[${tag}] FAILED\n${[...new Set(errors)].join('\n')}`);
  process.exit(1);
}
console.log(`[${tag}] ok, no console errors`);
