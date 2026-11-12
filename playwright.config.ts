import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui', outputDir: '.cache/ui-results',
  use: {baseURL:'http://127.0.0.1:1420', viewport:{width:1000,height:800}, channel:process.env.CI?'chromium':'msedge'},
  webServer: {command:'npm run dev',url:'http://127.0.0.1:1420',reuseExistingServer:!process.env.CI},
  reporter:'list'
});
