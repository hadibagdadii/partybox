import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createPartyboxServer } from './server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { config, warnings } = loadConfig(process.env, {
  webDist: path.resolve(here, '../../web/dist'),
});
const logger = createLogger();
for (const warning of warnings) logger.warn({ warning }, 'config_ignored');

const server = createPartyboxServer(config, logger);
const port = await server.listen(config.port);
logger.info(
  { port, env: config.isProd ? 'production' : 'development', devTools: config.devTools },
  'server_started',
);

/** Rooms live in memory, so stopping ends every game. Warn the clients, then close cleanly. */
let stopping = false;
const stop = (signal: string) => {
  if (stopping) {
    logger.warn({ signal }, 'server_forced_exit');
    process.exit(1);
  }
  stopping = true;
  logger.info({ signal }, 'server_stopping');
  setTimeout(() => {
    logger.error({ signal }, 'server_shutdown_timeout');
    process.exit(1);
  }, 5000).unref();
  void server.shutdown().then(() => {
    logger.info({}, 'server_stopped');
    process.exit(0);
  });
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'error');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'error');
});
