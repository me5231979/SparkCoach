// Phase 0 "done when": a process runs in the extension on a fixture app at Guide level, with the spotlight on the
// first target, automatic step detection, how/why checks, and completion.
import { expect, getRun, test } from "./extension.ts";
import type { Page, Worker } from "@playwright/test";

async function answerAll(panel: Page, sw: Worker) {
  // Answer the panel's questions correctly (the right index is read from the run, which only the test can see).
  for (let i = 0; i < 4; i++) {
    const run = await getRun(sw);
    if (!run || (run.phase !== "check" && run.phase !== "prompt")) return;
    const q = run.questions[run.qi];
    await panel.locator(".options button").nth(q.answer).click();
    await panel.getByRole("button", { name: "Continue" }).click();
    await expect.poll(async () => (await getRun(sw)).qi !== run.qi || (await getRun(sw)).index !== run.index || (await getRun(sw)).phase !== run.phase).toBe(true);
  }
}

async function waitStep(sw: Worker, index: number, phase?: string) {
  await expect.poll(async () => { const r = await getRun(sw); return r && r.index === index && (!phase || r.phase === phase); }, { timeout: 10_000 }).toBe(true);
}

test("runs the demo process at Guide level with the spotlight and automatic detection", async ({ context, sw, extId }) => {
  const app = await context.newPage();
  await app.goto("http://localhost:4310/records");

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/panel.html`);
  await expect(panel.getByRole("heading", { name: "Change a record's owner" })).toBeVisible();
  await panel.getByRole("button", { name: "Start the coach" }).click();
  await expect(panel.getByText("Step 1 of 7")).toBeVisible();
  await expect(panel.getByText("Guide", { exact: true })).toBeVisible();

  // Spotlight on the first target: the first View button in the Records section.
  await app.bringToFront();
  const overlay = app.locator("spark-coach-overlay[data-on='true']");
  await expect(overlay).toHaveCount(1, { timeout: 5_000 });

  // Step 1: click View → page check (urlMatches) detects it → how/why checks in the panel.
  await app.getByRole("button", { name: "View" }).first().click();
  await waitStep(sw, 0, "check");
  await answerAll(panel, sw);
  await waitStep(sw, 1, "do");

  // Step 2: a known wrong click gets coached, then the right one.
  await expect(app.locator("spark-coach-overlay[data-on='true']")).toHaveCount(1);
  await app.getByRole("button", { name: "Edit Details" }).click();
  await expect(panel.locator(".feed.mistake")).toContainText("Edit Details changes the record's fields.");
  await app.getByRole("button", { name: "Change Owner" }).click();
  await waitStep(sw, 1, "check");
  await answerAll(panel, sw);

  // Steps 3–5: fields, detected locally (only true/false leaves the page).
  await waitStep(sw, 2, "do");
  await app.getByLabel("Effective Date").fill("2031-07-04");
  await waitStep(sw, 2, "check"); await answerAll(panel, sw);
  await waitStep(sw, 3, "do");
  await app.getByLabel("Reason").selectOption({ label: "Reassignment" });
  await waitStep(sw, 3, "check"); await answerAll(panel, sw);
  await waitStep(sw, 4, "do");
  await app.getByLabel("New Owner").fill("Morgan Typedname-Secret");
  await waitStep(sw, 4, "check"); await answerAll(panel, sw);

  // Step 6: submit → confirmation banner (textPresent).
  await waitStep(sw, 5, "do");
  await app.getByRole("button", { name: "Submit" }).click();
  await waitStep(sw, 5, "check"); await answerAll(panel, sw);

  // Step 7: off-screen, confirmed in the panel. Then the recap.
  await waitStep(sw, 6, "confirm");
  await panel.getByRole("button", { name: "I told them" }).click();
  await expect(panel.getByRole("heading", { name: /Done: Change a record's owner/ })).toBeVisible();
  const run = await getRun(sw);
  expect(run.status).toBe("complete");
  expect(run.results.filter((r: any) => r.type === "screen").every((r: any) => r.resolved)).toBe(true);
  // At Guide a known wrong click is coached but only the quiz answers decide the outcome (COACHING-MODEL §3).
  expect(run.results.find((r: any) => r.id === "start-edit").outcome).toBe("right");
  await expect(app.locator("spark-coach-overlay[data-on='true']")).toHaveCount(0);
});
