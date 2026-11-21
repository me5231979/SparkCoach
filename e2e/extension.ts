// Shared Playwright fixture: Chromium with the built Spark extension loaded (apps/extension/dist).
import { test as base, chromium, type BrowserContext, type Worker } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIST = resolve("apps/extension/dist");

export const test = base.extend<{ context: BrowserContext; sw: Worker; extId: string }>({
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "spark-e2e-")), {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    await use(ctx);
    await ctx.close();
  },
  sw: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(sw);
  },
  extId: async ({ sw }, use) => use(new URL(sw.url()).host),
});
export const expect = test.expect;

/** Read the run from the worker's storage (test-only peek; the page can't reach it). */
export const getRun = (sw: Worker) => sw.evaluate(async () => (await chrome.storage.local.get("spark.run"))["spark.run"] as any);
