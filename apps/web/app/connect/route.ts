// Extension sign-in (chrome.identity.launchWebAuthFlow): signed-in user → one-time code → redirect to the
// extension's chromiumapp.org URL. Not signed in → sign in first, then come back here.
import { createExtCode } from "@spark/db";
import { currentUser } from "../../lib/session";

const ALLOWED = (process.env.SPARK_EXTENSION_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const user0 = redirectUri ? null : await currentUser();
  if (!redirectUri) {
    // Manual fallback (e.g. when a company's policy blocks the sign-in pop-up): show a one-time code to paste.
    if (!user0) return Response.redirect(new URL(`/login?next=${encodeURIComponent("/connect")}`, req.url), 303);
    const code = await createExtCode(user0);
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in code</title>
<body style="font:15px system-ui;max-width:520px;margin:64px auto;padding:0 16px"><h1>Your sign-in code</h1>
<p>Paste this into the extension under <b>Have a sign-in code?</b> It works once, for 2 minutes.</p>
<input id="code" readonly value="${esc(code)}" style="width:100%;padding:10px;font:14px monospace" onclick="this.select()"></body>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  const m = redirectUri.match(/^https:\/\/([a-p]{32})\.chromiumapp\.org\/$/);
  if (!m || (ALLOWED.length && !ALLOWED.includes(m[1]!))) return new Response("This sign-in link isn't from the Spark extension.", { status: 400 });
  const user = await currentUser();
  if (!user) return Response.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, req.url), 303);
  const code = await createExtCode(user);
  return Response.redirect(`${redirectUri}?code=${encodeURIComponent(code)}`, 303);
}
