import os from 'os'
import path from 'path'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: path.join(os.tmpdir(), 'wine-erp-pw-results'),
    fullyParallel: false,
    workers: 1,
    retries: 1,
    timeout: 60_000,
    expect: {
        timeout: 15_000,
    },
    reporter: [['list']],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100',
        viewport: { width: 1440, height: 900 },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'msedge',
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
})
