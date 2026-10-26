import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('createApp', () => {
  it('responds on /healthz', async () => {
    const res = await request(createApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('sends JOIN_DISPLAY_URL from /api/config, or null when unset', async () => {
    const set = await request(createApp({ joinDisplayUrl: 'partybox.fun' })).get('/api/config');
    expect(set.body).toEqual({ joinDisplayUrl: 'partybox.fun' });
    expect(set.headers['cache-control']).toBe('no-store');
    const unset = await request(createApp()).get('/api/config');
    expect(unset.body).toEqual({ joinDisplayUrl: null });
  });

  it('answers /api/config ahead of the SPA fallback', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'partybox-web-'));
    writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
    const res = await request(createApp({ webDist: dir, joinDisplayUrl: 'x.example' })).get(
      '/api/config',
    );
    expect(res.body).toEqual({ joinDisplayUrl: 'x.example' });
  });

  it('serves the SPA shell for client routes when webDist is set', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'partybox-web-'));
    writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
    const app = createApp({ webDist: dir });
    for (const route of ['/host', '/play']) {
      const res = await request(app).get(route);
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="root"');
    }
  });
});
