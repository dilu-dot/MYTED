import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5188', channel: 'msedge', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npm run dev -- --port 5188 --strictPort', url: 'http://127.0.0.1:5188', reuseExistingServer: true },
})
