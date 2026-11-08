#!/usr/bin/env node
/**
 * Frame rate of the Cambio card gallery under CPU throttling, in the installed Chrome.
 *
 *   pnpm --filter @partybox/web exec vite --port 5373   # in another terminal
 *   node scripts/cambio-fps.mjs [--url http://localhost:5373/dev/cambio-cards] [--throttle 4] [--headed]
 *
 * Replays every motion primitive on the 6- and 12-player tables and reports, per primitive and
 * overall, the average fps, the 5th-percentile fps (from the 95th-percentile frame time), and
 * dropped frames (time beyond one 60 Hz frame, in frames).
 */
import puppeteer from 'puppeteer-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:5373/dev/cambio-cards');
const throttle = Number(arg('throttle', '4'));
const headed = process.argv.includes('--headed');
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PRIMITIVES = [
  'deal',
  'draw',
  'swap',
  'discard',
  'peekOwn',
  'peekOther',
  'blindSwap',
  'kingSwap',
  'snap',
  'snapGive',
  'wrongSnap',
  'reshuffle',
  'call',
  'reveal',
  'burst',
];
const FRAME = 1000 / 60;

function stats(frames) {
  if (!frames.length) return { fps: 0, p5: 0, dropped: 0, frames: 0 };
  const total = frames.reduce((a, b) => a + b, 0);
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted.at(-1);
  const dropped = frames.reduce((n, dt) => n + Math.max(0, Math.round(dt / FRAME) - 1), 0);
  return {
    fps: (frames.length * 1000) / total,
    p5: 1000 / p95,
    dropped,
    frames: frames.length,
  };
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: !headed,
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
  args: ['--no-first-run', '--no-default-browser-check'],
});
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__cambioGallery);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

  const rows = [];
  const all = [];
  for (const table of [6, 12]) {
    await page.evaluate((n) => window.__cambioGallery.setTable(n), table);
    await new Promise((r) => setTimeout(r, 800));
    for (const id of PRIMITIVES) {
      await page.evaluate((p) => {
        window.__cambioFrames = [];
        window.__cambioGallery.replay(p);
      }, id);
      // Wait for the broadcasts to finish and the motion queue to go idle.
      await page.waitForFunction(
        () =>
          !window.__cambioGallery.busy() &&
          document.querySelector('[data-motion]')?.getAttribute('data-motion') === 'idle',
        { timeout: 30000, polling: 50 },
      );
      await new Promise((r) => setTimeout(r, 450));
      const frames = await page.evaluate(() => {
        const f = window.__cambioFrames ?? [];
        window.__cambioFrames = null;
        // The first frame spans the replay click itself.
        return f.slice(1);
      });
      all.push(...frames);
      rows.push({ table, id, ...stats(frames) });
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `Chrome ${await browser.version()} · ${headed ? 'headed' : 'headless'} · CPU throttle ${throttle}x · 1600x1000\n`,
  );
  console.log(
    `${pad('table', 7)}${pad('primitive', 12)}${pad('avg fps', 9)}${pad('p5 fps', 8)}${pad('dropped', 9)}frames`,
  );
  for (const r of rows) {
    console.log(
      `${pad(r.table, 7)}${pad(r.id, 12)}${pad(r.fps.toFixed(1), 9)}${pad(r.p5.toFixed(1), 8)}${pad(r.dropped, 9)}${r.frames}`,
    );
  }
  const total = stats(all);
  console.log(
    `\nOverall: ${total.fps.toFixed(1)} fps average, ${total.p5.toFixed(1)} fps at the 5th percentile, ${total.dropped} dropped of ${total.frames} frames.`,
  );
} finally {
  await browser.close();
}
