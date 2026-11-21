import { defineConfig } from "@playwright/test";

const platform = !!process.env.SPARK_TEST_DATABASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  workers: 1, // one persistent browser with the extension at a time
  reporter: [["list"]],
  use: { trace: "off" },
  projects: [
    { name: "offline", testIgnore: /platform\.spec/ },
    // The full make → deploy → run → insight loop against the real web app and a real Postgres.
    ...(platform ? [{ name: "platform", testMatch: /platform\.spec/ }] : []),
  ],
  webServer: [
    { command: "node fixtures/serve.mjs", url: "http://localhost:4310/records", reuseExistingServer: true, timeout: 20_000 },
    ...(platform ? [{ command: "node --experimental-strip-types --no-warnings e2e/web-server.mjs", url: "http://localhost:3100/api/health", reuseExistingServer: false, timeout: 60_000 }] : []),
  ],
});
