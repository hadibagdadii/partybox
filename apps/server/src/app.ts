import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { silentLogger, type Logger } from './logger.js';

export interface AppOptions {
  /** Directory of the built web app. Served with SPA fallback when set. */
  webDist?: string | undefined;
  /** Proxies in front of the server whose X-Forwarded-For entries are trusted. */
  trustProxyHops?: number;
  /** Extra origin the page may open sockets to, besides its own. */
  allowedOrigin?: string | undefined;
  /** Short join address for the TV to show; sent by /api/config. */
  joinDisplayUrl?: string | undefined;
  logger?: Logger;
}

/** Same origin only, plus Google Fonts for the stylesheet and font files. */
export function contentSecurityPolicy(allowedOrigin?: string) {
  const connectSrc = ["'self'"];
  if (allowedOrigin) connectSrc.push(allowedOrigin, allowedOrigin.replace(/^http/, 'ws'));
  return {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc,
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  };
}

export function createApp({
  webDist,
  trustProxyHops = 0,
  allowedOrigin,
  joinDisplayUrl,
  logger = silentLogger,
}: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(helmet({ contentSecurityPolicy: contentSecurityPolicy(allowedOrigin) }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // Read at runtime, so one build serves any deployment.
  app.get('/api/config', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ joinDisplayUrl: joinDisplayUrl ?? null });
  });

  if (webDist && existsSync(webDist)) {
    app.use(express.static(webDist, { index: false }));
    // Client-side routes (/host, /play, ...) all load the SPA shell.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  // Express spots error handlers by their four parameters, so `_next` must stay.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onError: ErrorRequestHandler = (err: unknown, req, res, _next) => {
    logger.error({ err, path: req.path }, 'error');
    res.status(500).json({ ok: false });
  };
  app.use(onError);

  return app;
}
