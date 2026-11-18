import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const { app } = createApp(config);

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`Review tool running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${info.port}`);
  if (config.lan) console.warn('WARNING: --host-lan exposes this app on your network. There is no user authentication.');
});
