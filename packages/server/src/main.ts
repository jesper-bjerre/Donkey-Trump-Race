import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = await createServer(config, { logger: true });

await server.app.listen({ port: config.port, host: config.host });
server.app.log.info(
  { allowSolo: config.allowSolo, servingClient: config.clientDistDir !== null },
  'Donkey Trump Race server ready',
);

const shutdown = async (signal: string) => {
  server.app.log.info({ signal }, 'shutting down');
  await server.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
