// URL paths, privacy-safe: query strings and fragments with identifiers are dropped, ids become "*".
export function safePath(href: string): string {
  let u: URL;
  try { u = new URL(href, "http://x.invalid"); } catch { return "/"; }
  const segs = u.pathname.split("/").map((s) =>
    /^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) || /^[A-Za-z0-9_-]{20,}$/.test(s) ? "*" : s);
  return segs.join("/") || "/";
}

/** urlMatches: the authored pattern is tested against path (+ hash), never the query string. */
export function urlMatches(pattern: string, href: string): boolean {
  let u: URL;
  try { u = new URL(href, "http://x.invalid"); } catch { return false; }
  const here = u.pathname + u.hash;
  try { return new RegExp(pattern).test(here); } catch { return here.includes(pattern); }
}
