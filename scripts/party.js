// Laptop game night: build, run the production server on :8080, expose it through a
// Cloudflare quick tunnel, keep the display awake, and print the public /host URL.
// Ctrl+C stops all three.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const LOCAL = `http://localhost:${PORT}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const onPath = (cmd) => spawnSync('sh', ['-c', 'command -v "$1"', 'sh', cmd]).status === 0;

if (!onPath('cloudflared')) {
  console.error('cloudflared is not installed. Install it with:\n\n  brew install cloudflared\n');
  process.exit(1);
}

console.log('Building Partybox...');
if (spawnSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' }).status !== 0) {
  console.error('Build failed.');
  process.exit(1);
}

/** @type {Map<string, import('node:child_process').ChildProcess>} */
const children = new Map();
let stopping = false;

function start(name, cmd, args, options = {}) {
  const child = spawn(cmd, args, { cwd: root, ...options });
  children.set(name, child);
  child.on('exit', (code, signal) => {
    children.delete(name);
    if (!stopping) {
      console.error(`\n${name} exited unexpectedly (${signal ?? `code ${code}`}). Stopping.`);
      stop(1);
    } else if (children.size === 0) {
      process.exit(exitCode);
    }
  });
  return child;
}

let exitCode = 0;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  console.log('\nStopping server, tunnel, and caffeinate...');
  if (children.size === 0) process.exit(exitCode);
  // SIGINT lets the server warn connected clients before it exits.
  children.get('server')?.kill('SIGINT');
  children.get('cloudflared')?.kill('SIGTERM');
  children.get('caffeinate')?.kill('SIGTERM');
  setTimeout(() => {
    for (const child of children.values()) child.kill('SIGKILL');
    process.exit(exitCode || 1);
  }, 8000).unref();
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

/** Stops everything and never resolves, so nothing after it runs. */
function fail(message) {
  console.error(message);
  stop(1);
  return new Promise(() => {});
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

start('server', process.execPath, ['apps/server/dist/index.js'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    // cloudflared connects from localhost; Cloudflare's edge appends the visitor to
    // X-Forwarded-For and overwrites CF-Connecting-IP, so either names the real client.
    TRUST_PROXY_HOPS: '1',
    CLIENT_IP_HEADER: 'cf-connecting-ip',
  },
});
if (!(await waitFor(`${LOCAL}/healthz`, 15_000))) {
  await fail('Server did not become healthy.');
}

start('caffeinate', 'caffeinate', ['-d'], { stdio: 'ignore' });

const tunnel = start('cloudflared', 'cloudflared', ['tunnel', '--no-autoupdate', '--url', LOCAL], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
const publicUrl = await new Promise((resolve) => {
  let buffer = '';
  const onData = (chunk) => {
    buffer += chunk.toString();
    const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      tunnel.stderr.off('data', onData);
      tunnel.stdout.off('data', onData);
      resolve(match[0]);
    }
  };
  tunnel.stderr.on('data', onData);
  tunnel.stdout.on('data', onData);
});
// Drain cloudflared's output so its pipes never fill up.
tunnel.stdout.resume();
tunnel.stderr.resume();

console.log(`\nTunnel created: ${publicUrl}. Waiting for it to go live...`);
if (!(await waitFor(`${publicUrl}/healthz`, 180_000))) {
  await fail('The tunnel did not answer within 3 minutes. Try again.');
}
banner(publicUrl);

function banner(url) {
  const host = `${url}/host`;
  const rule = '='.repeat(Math.max(host.length + 4, 60));
  // DEC double-height lines (ESC#3 top half, ESC#4 bottom half) render large in
  // Terminal.app and iTerm2; the plain line after them is for copy and paste.
  const big = (text) => `\x1b#3\x1b[1m${text}\x1b[0m\n\x1b#4\x1b[1m${text}\x1b[0m`;
  console.log(
    [
      '',
      rule,
      big('Partybox is live'),
      '',
      big('Open on the TV:'),
      big(host),
      '',
      `  ${host}`,
      `  Phones join at ${url}/play`,
      '',
      '  Keep this laptop awake and on power. Ctrl+C ends every game.',
      rule,
      '',
    ].join('\n'),
  );
}
