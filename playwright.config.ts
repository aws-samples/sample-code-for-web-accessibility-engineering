import { defineConfig } from '@playwright/test'

// a11y 自动化测试配置：跑测试时自动起 vite dev（若已在跑则复用）
export default defineConfig({
  testDir: './a11y-tests',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5180' },
  webServer: {
    command: 'npm run dev -- --port 5180',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
