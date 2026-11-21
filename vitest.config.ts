import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/extension/src/**/*.test.ts", "apps/web/lib/**/*.test.ts"],
    environment: "node",
    // Server modules import "server-only" (a Next.js guard); unit tests run them in plain Node.
    alias: { "server-only": new URL("./e2e/server-only-stub.ts", import.meta.url).pathname },
  },
});
