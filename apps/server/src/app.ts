import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface AppOptions {
  /** Directory of the built web app. Served with SPA fallback when set. */
  webDist?: string | undefined;
}

export function createApp({ webDist }: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  if (webDist && existsSync(webDist)) {
    app.use(express.static(webDist, { index: false }));
    // Client-side routes (/host, /play, ...) all load the SPA shell.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}
