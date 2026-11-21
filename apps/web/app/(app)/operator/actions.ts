"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createInvite, createOrg, setPlan } from "@spark/db";
import { ORG_COOKIE, requireCtx } from "../../../lib/session";

export async function addCustomer(form: FormData) {
  const c = await requireCtx("operator");
  const r = await createOrg(c.user.orgId, c.user.id, String(form.get("name") ?? ""));
  if ("error" in r) redirect("/operator?error=" + encodeURIComponent(r.error));
  const email = String(form.get("adminEmail") ?? "").trim();
  if (email) {
    const inv = await createInvite(r.id, c.user.id, email, ["admin", "author", "manager"]);
    if ("error" in inv) redirect("/operator?error=" + encodeURIComponent(inv.error));
    redirect(`/operator?invite=${encodeURIComponent(inv.token)}&for=${encodeURIComponent(email)}`);
  }
  redirect("/operator");
}

export async function openOrg(form: FormData) {
  await requireCtx("operator");
  const jar = await cookies();
  jar.set(ORG_COOKIE, String(form.get("orgId") ?? ""), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  redirect("/studio");
}

export async function leaveOrg() {
  const jar = await cookies();
  jar.delete(ORG_COOKIE);
  redirect("/operator");
}

export async function savePlan(form: FormData) {
  const c = await requireCtx("operator");
  await setPlan(String(form.get("orgId")), c.user.orgId, c.user.id, String(form.get("plan") ?? "platform"), {
    managedAi: form.get("managedAi") === "on", reports: form.get("reports") === "on", whiteLabel: form.get("whiteLabel") === "on",
  });
  redirect("/operator");
}
