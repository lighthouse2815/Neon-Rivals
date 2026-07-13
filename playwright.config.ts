import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/client/e2e",
  fullyParallel: false,
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "pnpm -C . run preview:e2e",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
