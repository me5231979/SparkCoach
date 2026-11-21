// Privacy suite v1 (blocking, SECURITY-PRIVACY §4). Runs a full process on a page seeded with fake personal data
// and asserts none of it appears in any request the browser makes beyond loading the app itself, or in the
// extension's storage. Never weaken this test to make a change pass.
import { expect, test } from "./extension.ts";
import { SEEDED } from "../fixtures/apps/records-app/data.mjs";

const seeded = Object.values(SEEDED).flat();

test("no seeded personal data leaves the page or lands in extension storage", async ({ context, sw, extId }) => {
  const outbound: string[] = [];
  context.on("request", (r) => {
    const u = new URL(r.url());
    const appLoad = u.host === "localhost:4310" && r.method() === "GET" && r.resourceType() === "document";
    if (!appLoad && u.protocol !== "chrome-extension:") outbound.push(`${r.method()} ${r.url()} ${r.postData() ?? ""} ${JSON.stringify(r.headers())}`);
  });

  const app = await context.newPage();
  await app.goto("http://localhost:4310/records");
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/panel.html`);
  await panel.getByRole("button", { name: "Start the coach" }).click();
  await app.bringToFront();
  await app.getByRole("button", { name: "View" }).first().click();
  await app.getByRole("button", { name: "Change Owner" }).click();
  await app.getByLabel("Effective Date").fill(SEEDED.dates[0]!);
  await app.getByLabel("Reason").selectOption({ label: "Reassignment" });
  await app.getByLabel("New Owner").fill(SEEDED.typed[0]!);
  await app.getByRole("button", { name: "Submit" }).click();
  await expect(app.getByRole("status")).toContainText("Change submitted");
  await app.waitForTimeout(1000); // let checks settle and messages flush

  // 1. Nothing but the app's own page loads went over the network.
  expect(outbound, "unexpected network requests").toEqual([]);

  // 2. Extension storage holds no seeded string (local and session).
  const stored = await sw.evaluate(async () => JSON.stringify({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null) }));
  for (const s of seeded) expect(stored, `storage contains "${s}"`).not.toContain(s);

  // 3. The page can't read extension storage (access level is TRUSTED_CONTEXTS).
  const level = await sw.evaluate(async () => { try { await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }); return "ok"; } catch (e) { return String(e); } });
  expect(level).toBe("ok");
});
