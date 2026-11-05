import { defineConfig } from '@playwright/test';

const remote = process.env.VIEWER_URL;
export default defineConfig({
  testDir: './test',
  testMatch: 'browser.spec.mjs',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: remote || 'http://127.0.0.1:5180/discus-tank/',
    channel: 'chrome',
    reducedMotion: 'reduce',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
  webServer: remote ? undefined : {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5180/discus-tank/',
    reuseExistingServer: true,
  },
});
