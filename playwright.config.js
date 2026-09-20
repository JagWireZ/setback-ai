import { defineConfig, devices } from '@playwright/test'

const MOCK_BACKEND_PORT = 8787
const FRONTEND_PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `node e2e/mock-backend-server.mjs`,
      port: MOCK_BACKEND_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        MOCK_BACKEND_PORT: String(MOCK_BACKEND_PORT),
        TRICK_REVEAL_DELAY_MS: '0',
      },
    },
    {
      // The frontend needs the WebSocket URL baked in at build time (Vite inlines
      // `import.meta.env.*` during `vite build`), so build and serve it together here
      // rather than pointing `preview` at a build produced by some other command/env.
      command: `npm run build:frontend && npm run preview -- --port ${FRONTEND_PORT} --strictPort`,
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_WEBSOCKET_URL: `ws://localhost:${MOCK_BACKEND_PORT}`,
      },
    },
  ],
})
