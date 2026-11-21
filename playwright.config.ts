import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1, // one persistent browser with the extension at a time
  reporter: [["list"]],
  use: { trace: "off" },
  webServer: { command: "node fixtures/serve.mjs", url: "http://localhost:4310/records", reuseExistingServer: true, timeout: 20_000 },
});
