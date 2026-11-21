// Ask: grounded only in this org's published coaches and reference brand docs. Never sees the page.
import { ask, explain } from "@spark/ai";
import { creds, NO_KEY } from "../../../lib/ai";
import { themeOf } from "@spark/core";
import { getOrg, listBrandDocs, publishedBundle } from "@spark/db";
import { body, extUser, fail, json, limited } from "../../../lib/api";

export async function POST(req: Request) {
  const u = await extUser(req);
  if (!u) return fail("Sign in again.", 401);
  if (limited(`ask:${u.id}`, 40, 10 * 60_000)) return fail("You've asked a lot in a short time. Try again in a few minutes.", 429);
  const b = await body<{ question?: string; history?: { role: "user" | "assistant"; text: string }[]; processId?: string; stepId?: string }>(req, 20_000);
  if (!b?.question) return fail("Type a question first.");
  const ai = await creds(u.orgId);
  if (!ai) return fail(NO_KEY, 503);
  const [org, bundle, docs] = await Promise.all([getOrg(u.orgId), publishedBundle(u.orgId), listBrandDocs(u.orgId)]);
  const current = bundle.find((p) => p.slug === b.processId)?.content;
  try {
    const out = await ask({
      question: b.question, history: (b.history ?? []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string"),
      processes: bundle.map((p) => p.content), brandDocs: docs, displayName: themeOf(org!.branding).displayName,
      ...(current ? { currentProcess: current.title } : {}), ...(current && b.stepId ? { currentStep: current.steps.find((s) => s.id === b.stepId)?.title } : {}),
      apiKey: ai.apiKey, ...(ai.model ? { model: ai.model } : {}),
    });
    return json(out);
  } catch (e) {
    return fail(explain(e), 502);
  }
}
