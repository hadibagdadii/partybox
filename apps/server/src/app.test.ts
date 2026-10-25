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
