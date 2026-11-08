#!/usr/bin/env node
/**
 * Plays full Cambio games on the real phone UI at 375×812 against bots, in the installed Chrome,
 * and screenshots each flow the first time it shows up.
 *
 *   pnpm dev   # or any dev server with bots; set --url to its web origin
 *   node scripts/cambio-phone-playthrough.mjs [--url http://localhost:5273] [--mode single|match]
 *     [--bots 5] [--remember] [--out .claude/c4-screenshots] [--headed]
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
const base = arg('url', 'http://localhost:5273');
const mode = arg('mode', 'single');
const bots = Number(arg('bots', '5'));
const remember = process.argv.includes('--remember');
const out = arg('out', '.claude/c4-screenshots');
const headed = process.argv.includes('--headed');
const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome, headless: !headed });
const shots = new Set();
const log = (...a) => console.log(`[${mode}]`, ...a);

try {
  // ---- TV: a Cambio room with the chosen options ----
  const tv = await browser.newPage();
  await tv.setViewport({ width: 1280, height: 720 });
  await tv.goto(`${base}/host`, { waitUntil: 'networkidle0' });
  const clickText = (page, text, exact = false) =>
    page.evaluate(
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
  await clickText(tv, 'Create room');
  await sleep(500);
  await clickText(tv, 'Cambio');
  await sleep(300);
  if (mode === 'match') await clickText(tv, 'Match', true);
  if (remember) {
    // The "Remember peeks" toggle is the button after its label.
    await tv.evaluate(() => {
      const label = [...document.querySelectorAll('*')].find(
        (e) => e.children.length === 0 && e.textContent === 'Remember peeks',
      );
      const field = label?.closest('label, div, fieldset');
      const btn = [...(field?.parentElement?.querySelectorAll('button') ?? [])].find((b) =>
        /Off|On/.test(b.textContent),
      );
      btn?.click();
    });
  }
  await sleep(300);
  const code = await tv.evaluate(() => {
    const m = document.body.innerText.match(/play\?code=([A-Z]{4})/);
    return m?.[1];
  });
  log('room', code);

  // ---- Phone: join first, so this player is the VIP ----
  const phone = await browser.newPage();
  await phone.emulate({
    viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  phone.on('pageerror', (e) => log('PAGE ERROR', e.message));
  phone.on('console', (m) => m.type() === 'error' && log('console error', m.text().slice(0, 400)));
  await phone.goto(`${base}/play?code=${code}`, { waitUntil: 'networkidle0' });
  await phone.type('input', 'Hadi');
  await phone.keyboard.press('Enter');
  await sleep(800);

  for (let i = 0; i < bots; i++) {
    await clickText(tv, 'Add bot');
    await sleep(250);
  }
  await clickText(tv, 'Start');
  await sleep(1500);

  const shot = async (name, force = false) => {
    if (shots.has(name) && !force) return;
    shots.add(name);
    const file = join(out, `${mode}${remember ? '-remember' : ''}-${name}.png`);
    await phone.screenshot({ path: file });
    log('shot', file);
  };

  /** Everything the loop needs to decide, read from the phone's DOM. */
  const read = () =>
    phone.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')]
        .filter((b) => !b.disabled && b.offsetParent !== null)
        .map((b) => b.textContent.trim())
        .filter(Boolean);
      const dialog = document.querySelector('[role=dialog]');
      const hint = document.querySelector('[data-testid=action-bar] p')?.textContent ?? '';
      return {
        buttons,
        dialog: dialog?.getAttribute('aria-label') ?? null,
        pickable: dialog
          ? [
              ...dialog.querySelectorAll(
                'button[data-slot]:not([disabled]):not([aria-pressed=true])',
              ),
            ].map((b) => b.getAttribute('data-slot'))
          : [],
        hand: [...document.querySelectorAll('[data-testid=hand] button[data-slot]')].map((b) => {
          const r = b.getBoundingClientRect();
          return { slot: b.getAttribute('data-slot'), x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }),
        holdArea: (() => {
          const b = document.querySelector('[data-testid=hand] > button:not([data-slot])');
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })(),
        hint,
        banner: document.querySelector('[role=status]')?.textContent ?? null,
        roundEnd: !!document.querySelector('[data-testid=round-end]'),
        wrong: !!document.querySelector('[data-testid=wrong-snap]'),
        tooLate: !!document.querySelector('[data-testid=too-late]'),
        known: document.querySelectorAll('[data-testid=hand] [role=img]').length,
        cardsInHand: document.querySelectorAll('[data-testid=hand] button[data-slot]').length,
        over: /wins the game|win the game/.test(document.body.innerText),
      };
    });
  const has = (s, t) => s.buttons.includes(t);
  const tapAt = async (x, y) => {
    await phone.mouse.move(x, y);
    await phone.mouse.down();
    await phone.mouse.up();
  };
  const swipeUp = async (x, y) => {
    await phone.mouse.move(x, y);
    await phone.mouse.down();
    await phone.mouse.move(x, y - 30, { steps: 3 });
    await phone.mouse.move(x, y - 70, { steps: 3 });
    await phone.mouse.up();
  };

  let turns = 0;
  let snapTries = 0;
  let otherSnapTries = 0;
  let rounds = 0;
  let lastCards = 4;
  const deadline = Date.now() + Number(arg('minutes', '9')) * 60_000;
  while (Date.now() < deadline) {
    await sleep(350);
    const s = await read();
    if (s.wrong) await shot('wrong-snap');
    if (s.tooLate) await shot('too-late');
    if (s.known > 0) await shot('eye-badge');
    if (s.cardsInHand > lastCards) await shot('penalty-arrived');
    lastCards = s.cardsInHand;
    if (s.banner) await shot('cambio-banner');

    if (s.over) {
      await sleep(2500);
      await shot('game-over');
      break;
    }
    if (s.roundEnd) {
      await sleep(1200);
      await shot(`round-end-${rounds + 1}`);
      if (has(s, 'Next round')) {
        rounds += 1;
        await phone.evaluate(() =>
          [...document.querySelectorAll('button')]
            .find((b) => b.textContent === 'Next round')
            .click(),
        );
        await sleep(1500);
      }
      continue;
    }

    // Initial peek: hold, look, release, ready.
    if (has(s, "I'm ready") && s.holdArea) {
      await sleep(1600);
      await shot('peek-before');
      await phone.mouse.move(s.holdArea.x, s.holdArea.y);
      await phone.mouse.down();
      await sleep(700);
      await shot(`peek-held-${rounds + 1}`, true);
      await phone.mouse.up();
      await sleep(400);
      await clickText(phone, "I'm ready");
      continue;
    }

    if (s.dialog) {
      // Power targeting, King decisions, looking at a card, or a snap target.
      const name = s.dialog;
      if (/Pick the first card/.test(name)) await shot('picker-jack-first');
      else if (/Pick the second card/.test(name)) await shot('picker-jack-second');
      else if (/swap it with, or keep/.test(name)) await shot('picker-king-decide');
      else if (/Pick the card to snap/.test(name)) await shot('picker-snap-other');
      else if (/^It's the/.test(name)) await shot('picker-peek-face');
      else await shot('picker-peek');
      if (has(s, 'Done')) {
        await sleep(3400);
        await shot('picker-peek-flipped-back');
        await clickText(phone, 'Done', true);
      } else if (/swap it with, or keep/.test(name) && turns % 2 === 0 && has(s, 'Keep')) {
        await clickText(phone, 'Keep', true);
      } else if (s.pickable.length) {
        const pick = s.pickable[0];
        await phone.click(`[role=dialog] button[data-slot="${pick}"]`);
      } else if (has(s, 'Skip')) await clickText(phone, 'Skip', true);
      else if (has(s, 'Cancel')) await clickText(phone, 'Cancel', true);
      continue;
    }

    if (/Tap one of your cards to give/.test(s.hint)) {
      await shot('give-choose');
      await tapAt(s.hand[0].x, s.hand[0].y);
      continue;
    }
    if (has(s, 'Draw')) {
      turns += 1;
      await shot('your-turn');
      if (has(s, 'Call Cambio') && turns >= 4) {
        await shot('call-available');
        await clickText(phone, 'Call Cambio', true);
        continue;
      }
      await clickText(phone, 'Draw', true);
      await sleep(900);
      continue;
    }
    if (has(s, 'Discard')) {
      await shot('holding-drawn');
      // The drawn card is the only lifted card in your hand area's row of the table (z 55).
      const drawn = await phone.evaluate(
        () =>
          [...document.querySelectorAll('[data-card-id]')]
            .find((el) => el.style.zIndex === '55')
            ?.querySelector('[data-face]')
            ?.getAttribute('data-face') ?? '',
      );
      const power = /^(7|8|9|10|J|Q)-|^K-(spades|clubs)/.test(drawn);
      if (power) log('drew a power card', drawn);
      if (!power && turns % 3 === 1) {
        // Swap into a card.
        const c = s.hand[turns % s.hand.length];
        await tapAt(c.x, c.y);
        await sleep(600);
        await shot('after-swap');
      } else {
        await clickText(phone, 'Discard', true);
        await sleep(700);
      }
      continue;
    }
    if (has(s, 'Use it')) {
      await shot('power-prompt');
      await clickText(phone, 'Use it', true);
      continue;
    }
    if (/Tap one of your cards/.test(s.hint) && has(s, 'Skip')) {
      await shot('power-peek-own');
      await tapAt(s.hand[0].x, s.hand[0].y);
      await sleep(500);
      await shot('peek-own-face');
      continue;
    }
    if (has(s, 'Done')) {
      await sleep(3400);
      await clickText(phone, 'Done', true);
      continue;
    }
    if (has(s, 'Skip')) {
      await clickText(phone, 'Skip', true);
      continue;
    }

    // Not our turn: snap now and then, both paths.
    if (/turn/.test(s.hint) && s.hand.length) {
      await shot('waiting-turn');
      if (snapTries < 3 && Math.random() < 0.12) {
        snapTries += 1;
        const c = s.hand[snapTries % s.hand.length];
        if (snapTries === 2) {
          await tapAt(c.x, c.y);
          await sleep(250);
          await shot('snap-selected');
          await clickText(phone, 'Snap', true);
        } else {
          await swipeUp(c.x, c.y);
        }
        await sleep(500);
        await shot(`after-snap-${snapTries}`);
      } else if (
        otherSnapTries < 2 &&
        has(s, "Snap another player's card") &&
        Math.random() < 0.08
      ) {
        otherSnapTries += 1;
        await clickText(phone, "Snap another player's card", true);
      }
    }
  }
  await shot('final', true);
  log('final state', JSON.stringify(await read()).slice(0, 600));
  log('done; screenshots:', [...shots].join(', '));
} finally {
  await browser.close();
}
