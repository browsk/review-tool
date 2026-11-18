import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4173;
// fresh data directory per run so sessions from earlier runs never leak into tests
const dataDir = process.env.RT_E2E_DATA_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rt-e2e-'));
process.env.RT_E2E_DATA_DIR = dataDir;

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `npm run build && npx tsx src/server/index.ts --port=${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: { REVIEW_TOOL_DATA_DIR: dataDir },
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: /(xbrowser|perf)\.spec\.ts/ },
    { name: 'firefox', use: { browserName: 'firefox' }, testMatch: /xbrowser\.spec\.ts/ },
    { name: 'webkit', use: { browserName: 'webkit' }, testMatch: /xbrowser\.spec\.ts/ },
    { name: 'perf', use: { browserName: 'chromium' }, testMatch: /perf\.spec\.ts/ },
  ],
});
