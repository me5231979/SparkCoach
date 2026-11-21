// MVP "done when": the whole loop on the real web app + Postgres + the platform extension build.
// Operator sets up Spark → adds a customer → customer admin brands it, approves a system, makes and publishes a
// coach → a learner signs the extension in, runs the coach on the fixture app → the run shows up in Insight.
// Also asserts the white label reaches the extension and nothing personal reaches the server.
import { readFileSync } from "node:fs";
import type { Page, Worker } from "@playwright/test";
import { expect, getRun, test } from "./extension.ts";
import { SEEDED } from "../fixtures/apps/records-app/data.mjs";

const WEB = "http://localhost:3100";
const demo = JSON.parse(readFileSync("fixtures/processes/demo-change-owner.process.json", "utf8"));

async function answerAll(panel: Page, sw: Worker) {
  for (let i = 0; i < 4; i++) {
    const run = await getRun(sw);
    if (!run || (run.phase !== "check" && run.phase !== "prompt")) return;
    await panel.locator(".options button").nth(run.questions[run.qi].answer).click();
    await panel.getByRole("button", { name: "Continue" }).click();
    await expect.poll(async () => { const r = await getRun(sw); return r.qi !== run.qi || r.index !== run.index || r.phase !== run.phase; }).toBe(true);
  }
}
const waitStep = (sw: Worker, index: number, phase?: string) =>
  expect.poll(async () => { const r = await getRun(sw); return !!r && r.index === index && (!phase || r.phase === phase); }, { timeout: 10_000 }).toBe(true);

test("make → deploy → run → insight, white-labelled, with nothing personal sent", async ({ context, sw, extId }) => {
  const web = await context.newPage();
  const serverBodies: string[] = [];
  context.on("request", (r) => { if (r.url().startsWith(WEB + "/api/")) serverBodies.push(`${r.url()} ${r.postData() ?? ""}`); });

  // 1. Operator: first-run setup, add a customer with an admin invite.
  await web.goto(WEB + "/");
  await expect(web).toHaveURL(/\/setup/);
  await web.getByLabel("Setup code").fill("e2e-setup-code");
  await web.getByLabel("Your name").fill("Olive Operator");
  await web.getByLabel("Work email").fill("olive@matchlight.test");
  await web.getByLabel("Password").fill("operator password 1");
  await web.getByRole("button", { name: "Create and sign in" }).click();
  await expect(web.getByRole("heading", { name: "Customers" })).toBeVisible();
  await web.getByLabel("Company name").fill("Acme Corp");
  await web.getByLabel("Their admin's email (optional)").fill("ada@acme.test");
  await web.getByRole("button", { name: "Add customer" }).click();
  const invite = await web.getByLabel("Invite link").inputValue();
  expect(invite).toContain("/invite/");
  await web.getByRole("button", { name: "Sign out" }).click();

  // 2. Customer admin joins, approves a system, white-labels.
  await web.goto(invite);
  await web.getByLabel("Your name").fill("Ada Admin");
  await web.getByLabel("Choose a password").fill("customer password 1");
  await web.getByRole("button", { name: "Join" }).click();
  await expect(web.getByRole("heading", { name: "Studio" })).toBeVisible();
  await web.goto(WEB + "/settings");
  await web.getByLabel("Hosts (one per line)").fill("localhost:4310");
  await web.getByRole("button", { name: "Save systems" }).click();
  await expect(web.getByText("Saved.", { exact: true })).toBeVisible();
  await web.getByLabel("Product name your people see").fill("Acme Coach");
  await web.locator("#ac").fill("#0b6e4f");
  await web.getByRole("button", { name: "Save brand" }).click();
  await expect(web.getByText("Brand saved.")).toBeVisible();
  await web.getByRole("button", { name: "Write one here" }).click();
  await web.getByLabel("Markdown").fill("# Voice\n- Warm and brief.\n- Say \"record\", never \"entry\".");
  await web.getByRole("button", { name: "Save file" }).click();
  await expect(web.getByRole("cell", { name: "voice.md" })).toBeVisible();
  await expect(web.locator(".brand")).toContainText("Acme Coach"); // Studio itself is white-labelled
  // No AI key yet: AI features say so in plain words (the customer brings their own key).
  await expect(web.getByText("Anthropic API key")).toBeVisible();

  // 3. Make and publish a coach (blank → Advanced JSON → publish).
  await web.goto(WEB + "/studio");
  await web.getByPlaceholder("Process name").fill("Change a record's owner");
  await web.getByRole("button", { name: "Create" }).click();
  await web.getByRole("button", { name: "Advanced (JSON)" }).click();
  await web.getByLabel("Coach JSON").fill(JSON.stringify(demo));
  await web.getByRole("button", { name: "Apply" }).click();
  await web.getByRole("button", { name: "Publish" }).click();
  await expect(web.getByText(/Published v1/)).toBeVisible();

  // 4. The extension: sign in with a one-time code, get the org's coaches and brand.
  await web.goto(WEB + "/connect");
  const code = await web.locator("#code").inputValue();
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/panel.html`);
  await panel.getByText("Have a sign-in code?").click();
  await panel.getByLabel("Sign-in code").fill(code);
  await panel.getByRole("button", { name: "Use code" }).click();
  await expect(panel.getByRole("heading", { name: "Change a record's owner" })).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator(".top")).toContainText("Acme Coach");
  await expect.poll(() => panel.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).toBe("#0b6e4f");
  await expect(panel.getByRole("button", { name: "Ask Acme Coach" })).toBeVisible();

  // 5. Run it on the fixture system (content script registered for the approved host).
  const app = await context.newPage();
  await app.goto("http://localhost:4310/records");
  await panel.bringToFront();
  await panel.getByRole("button", { name: "Start the coach" }).click();
  await app.bringToFront();
  await expect(app.locator("spark-coach-overlay[data-on='true']")).toHaveCount(1, { timeout: 10_000 });
  await app.getByRole("button", { name: "View" }).first().click();
  await waitStep(sw, 0, "check"); await answerAll(panel, sw);
  await waitStep(sw, 1, "do"); await app.getByRole("button", { name: "Change Owner" }).click();
  await waitStep(sw, 1, "check"); await answerAll(panel, sw);
  await waitStep(sw, 2, "do"); await app.getByLabel("Effective Date").fill(SEEDED.dates[0]!);
  await waitStep(sw, 2, "check"); await answerAll(panel, sw);
  await waitStep(sw, 3, "do"); await app.getByLabel("Reason").selectOption({ label: "Reassignment" });
  await waitStep(sw, 3, "check"); await answerAll(panel, sw);
  await waitStep(sw, 4, "do"); await app.getByLabel("New Owner").fill(SEEDED.typed[0]!);
  await waitStep(sw, 4, "check"); await answerAll(panel, sw);
  await waitStep(sw, 5, "do"); await app.getByRole("button", { name: "Submit" }).click();
  await waitStep(sw, 5, "check"); await answerAll(panel, sw);
  await waitStep(sw, 6, "confirm");
  await panel.getByRole("button", { name: "I told them" }).click();
  await expect(panel.getByRole("heading", { name: /Done: Change a record's owner/ })).toBeVisible();

  // 6. The run synced (queue empty) and the server's levels came back.
  await expect.poll(async () => sw.evaluate(async () => ((await chrome.storage.local.get("spark.queue"))["spark.queue"] ?? []).length), { timeout: 10_000 }).toBe(0);
  const levels = await sw.evaluate(async () => (await chrome.storage.local.get("spark.levels"))["spark.levels"]);
  // Studio keeps the id it assigned at creation (learner records refer to it), not the pasted one.
  expect(levels["change-a-record-s-owner"]["open-record"]).toEqual({ level: 1, streak: 1 });

  // 7. Insight shows it.
  await web.goto(WEB + "/insight");
  await expect(web.getByRole("cell", { name: "Ada Admin" })).toBeVisible();
  await expect(web.getByRole("row", { name: /Ada Admin.*Change a record's owner.*1/ })).toBeVisible();

  // 8. Privacy: nothing seeded (names, SSNs, salaries, typed values) went to the Spark API.
  const sent = serverBodies.join("\n");
  for (const s of Object.values(SEEDED).flat()) expect(sent, `sent "${s}"`).not.toContain(s);
});
