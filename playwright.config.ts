import { defineConfig, devices } from "@playwright/test";

/**
 * E2e lane (spec 01 task 6): production build served locally against the
 * scripted mock backend — key-free by design, like every CI lane. The env
 * block below is the entire test configuration; nothing secret.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    httpCredentials: { username: "admin", password: "e2e-admin-password" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      MOCK_AGENT: "1",
      ADMIN_PASSWORD: "e2e-admin-password",
      RATE_LIMIT_PER_HOUR: "1000",
    },
  },
});
