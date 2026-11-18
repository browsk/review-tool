import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = 4173;
export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `npm run build && npx tsx src/server/index.ts --port=${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: { REVIEW_TOOL_DATA_DIR: path.join(os.tmpdir(), 'rt-e2e-data') },
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
