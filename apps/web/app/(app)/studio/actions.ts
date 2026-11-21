"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { draftProcess, explain } from "@spark/ai";
import { creds, NO_KEY } from "../../../lib/ai";
import type { Process } from "@spark/core";
import { validateProcess } from "@spark/core/validate";
import { archive, createProcess, listBrandDocs, publish, restoreVersion, saveDraft } from "@spark/db";
import { requireCtx } from "../../../lib/session";

const blank = (title: string, systems: string[]): Process => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "new-coach",
  title: title || "New coach", goal: "Describe what the learner will be able to do.", systems,
  steps: [{ id: "first-step", type: "checkpoint", title: "First step", instruction: "Describe the first step.", confirm: "Done" }],
  recap: { summary: "You finished the process." },
});

export async function createBlank(form: FormData) {
  const c = await requireCtx("author");
  const { id } = await createProcess(c.org.id, c.user.id, blank(String(form.get("title") ?? "").trim(), c.org.approvedDomains.slice(0, 1)));
  redirect(`/studio/${id}`);
}

export async function createFromNotes(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const c = await requireCtx("author");
  const ai = await creds(c.org.id);
  if (!ai) return { error: NO_KEY };
  const systems = form.getAll("systems").map(String).filter((s) => c.org.approvedDomains.includes(s));
  let id: string;
  try {
    const { process } = await draftProcess({
      notes: String(form.get("notes") ?? ""), title: String(form.get("title") ?? "").trim() || undefined,
      systems: systems.length ? systems : c.org.approvedDomains.slice(0, 1),
      brandDocs: await listBrandDocs(c.org.id), displayName: c.org.branding.displayName, apiKey: ai.apiKey, ...(ai.model ? { model: ai.model } : {}),
    });
    id = (await createProcess(c.org.id, c.user.id, process)).id;
  } catch (e) {
    return { error: explain(e) };
  }
  redirect(`/studio/${id}?drafted=1`);
}

export async function saveAction(id: string, draft: Process): Promise<{ errors: string[] }> {
  const c = await requireCtx("author");
  const r = await saveDraft(c.org.id, c.user.id, id, draft);
  if ("error" in r && r.error) return { errors: [r.error] };
  const v = validateProcess(draft);
  revalidatePath(`/studio/${id}`);
  return { errors: v.ok ? [] : v.errors };
}

export async function publishAction(id: string, draft: Process): Promise<{ errors: string[]; version?: number }> {
  const c = await requireCtx("author");
  const s = await saveDraft(c.org.id, c.user.id, id, draft);
  if ("error" in s && s.error) return { errors: [s.error] };
  const r = await publish(c.org.id, c.user.id, id, c.org.approvedDomains);
  revalidatePath("/studio");
  return r.ok ? { errors: [], version: r.version } : { errors: r.errors };
}

export async function restoreAction(form: FormData) {
  const c = await requireCtx("author");
  const id = String(form.get("id"));
  await restoreVersion(c.org.id, c.user.id, id, Number(form.get("version")));
  redirect(`/studio/${id}`);
}

export async function archiveAction(form: FormData) {
  const c = await requireCtx("author");
  await archive(c.org.id, c.user.id, String(form.get("id")));
  redirect("/studio");
}
