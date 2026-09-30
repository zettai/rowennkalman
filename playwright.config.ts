import { defineConfig, devices } from "@playwright/test";

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
      // An empty value here wins over the file, so the tests can only ever touch .data-e2e/.
      ROWENNKALMAN_S3_ENDPOINT: "",
      ROWENNKALMAN_S3_REGION: "",
      ROWENNKALMAN_S3_BUCKET: "",
      ROWENNKALMAN_S3_ACCESS_KEY: "",
      ROWENNKALMAN_S3_SECRET_KEY: "",
      ROWENNKALMAN_PUBLIC_IMAGE_BASE: "",
      ROWENNKALMAN_RESEND_API_KEY: "",
      ROWENNKALMAN_CONTACT_TO: "",
      ROWENNKALMAN_CONTACT_FROM: "",
      ROWENNKALMAN_ADMIN_EMAILS: E2E_EMAIL,
      ROWENNKALMAN_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
