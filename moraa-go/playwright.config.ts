import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 8792;
const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), 'moraa-e2e-'));
process.env.E2E_DATA_DIR = dataDir;

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, locale: 'pt-BR', trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'galaxy-s20fe', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 800 }, deviceScaleFactor: 3 }, testMatch: /mobile|a11y/ },
  ],
  webServer: {
    command: 'npx tsx server/index.ts',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), DATA_DIR: dataDir, NODE_ENV: 'development', ADMIN_PASSWORD: '', SEED_DEMO: 'true' },
  },
});
