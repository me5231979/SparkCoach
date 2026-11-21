"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Branding } from "@spark/core";
import { createInvite, deleteBrandDoc, saveBrandDoc, setApprovedDomains, setBranding, type Role } from "@spark/db";
import { requireCtx } from "../../../lib/session";

export async function saveDomains(form: FormData) {
  const c = await requireCtx("admin");
  const r = await setApprovedDomains(c.org.id, c.user.id, String(form.get("domains") ?? "").split(/[\s,]+/));
  redirect("/settings?" + ("error" in r ? `error=${encodeURIComponent(r.error)}` : "saved=systems"));
}

export async function invite(form: FormData) {
  const c = await requireCtx("admin");
  const roles = form.getAll("roles").map(String) as Role[];
  const email = String(form.get("email") ?? "").trim();
  const r = await createInvite(c.org.id, c.user.id, email, roles);
  redirect("/settings?" + ("error" in r ? `error=${encodeURIComponent(r.error)}` : `invite=${encodeURIComponent(r.token)}&for=${encodeURIComponent(email)}`) + "#people");
}

export async function saveBrand(b: Branding): Promise<{ error?: string }> {
  const c = await requireCtx("admin");
  const r = await setBranding(c.org.id, c.user.id, b);
  if ("error" in r) return { error: r.error };
  revalidatePath("/", "layout");
  return {};
}

export async function saveDoc(d: { name: string; kind: string; body: string }): Promise<{ error?: string }> {
  const c = await requireCtx("admin");
  const r = await saveBrandDoc(c.org.id, c.user.id, d);
  if ("error" in r) return { error: r.error };
  revalidatePath("/settings");
  return {};
}

export async function removeDoc(id: string) {
  const c = await requireCtx("admin");
  await deleteBrandDoc(c.org.id, c.user.id, id);
  revalidatePath("/settings");
}

export async function saveAi(s: { key?: string | null; model?: string }): Promise<{ error?: string }> {
  const c = await requireCtx("admin");
  const { setAiSettings } = await import("@spark/db");
  const r = await setAiSettings(c.org.id, c.user.id, s);
  revalidatePath("/settings");
  return "error" in r ? { error: r.error } : {};
}

export async function testAi(): Promise<{ error?: string }> {
  const c = await requireCtx("admin");
  const { testKey } = await import("@spark/ai");
  const { creds, NO_KEY } = await import("../../../lib/ai");
  const ai = await creds(c.org.id);
  if (!ai) return { error: NO_KEY };
  const r = await testKey(ai.apiKey);
  return "error" in r ? { error: r.error } : {};
}
