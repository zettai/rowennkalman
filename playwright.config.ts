import { defineConfig, devices } from "@playwright/test";
import { blankProdEnv } from "./scripts/blank-prod-env";

/**
 * E2E runs against a production build (`next build && next start`) with a
 * FileStore in .data-e2e/, wiped before each run. No network, no real secrets.
 */
export const E2E_EMAIL = "editor@example.com";
export const E2E_DATA_DIR = ".data-e2e";
const PORT = 3200; // 3100 is the usual dev server

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -rf ${E2E_DATA_DIR} && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/admin/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      ROWENNKALMAN_DATA_DIR: E2E_DATA_DIR,
      ROWENNKALMAN_SESSION_SECRET: "e2e-session-secret-e2e-session-secret-0000",
      // Next also reads .env.local, which on a developer machine holds the REAL bucket and mail keys.
      // Empty values from blankProdEnv win over the file, so the tests can only ever touch .data-e2e/.
      ...blankProdEnv,
      ROWENNKALMAN_ADMIN_EMAILS: E2E_EMAIL,
      ROWENNKALMAN_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
