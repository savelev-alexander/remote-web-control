import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BIN  = path.join(ROOT, 'dist', 'remote-web-control-server');
const PORT = process.env.E2E_PORT ?? '18080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    actionTimeout: 7_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: BIN,
    cwd: path.join(ROOT, 'dist'),
    port: Number(PORT),
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT,
      PUBLIC_HOST: '127.0.0.1',
      SESSION_TTL_MINUTES: process.env.E2E_TTL_MIN ?? '30',
    },
  },
});
