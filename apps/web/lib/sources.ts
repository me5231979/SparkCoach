// Turn uploaded files (private Blob) into AI sources. Files are read, converted, then deleted: Spark doesn't keep
// the author's documents after drafting.
import "server-only";
import { del, get } from "@vercel/blob";
import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import type { Source } from "@spark/ai";

export type Uploaded = { pathname: string; name: string; contentType: string };

async function bytes(pathname: string): Promise<Buffer> {
  const r = await get(pathname, { access: "private" });
  if (!r || !r.stream) throw new Error("A file went missing. Upload it again.");
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

const xmlText = (xml: string) =>
  [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((p) => [...p[1]!.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(""))
    .map((l) => l.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim())
    .filter(Boolean).join("\n");

/** PowerPoint: each slide's text, then its speaker notes, in slide order. */
export function pptxText(buf: Uint8Array): string {
  const files = unzipSync(buf, { filter: (f) => /^ppt\/(slides|notesSlides)\/(slide|notesSlide)\d+\.xml$/.test(f.name) });
  const num = (n: string) => Number(n.match(/(\d+)\.xml$/)![1]);
  const slides = Object.keys(files).filter((n) => n.startsWith("ppt/slides/")).sort((a, b) => num(a) - num(b));
  return slides.map((s) => {
    const n = num(s);
    const notes = files[`ppt/notesSlides/notesSlide${n}.xml`];
    return `Slide ${n}:\n${xmlText(strFromU8(files[s]!))}${notes ? `\nSpeaker notes: ${xmlText(strFromU8(notes))}` : ""}`;
  }).join("\n\n");
}

export async function toSources(files: Uploaded[], orgId: string): Promise<Source[]> {
  const out: Source[] = [];
  try {
    for (const f of files) {
      if (!f.pathname.startsWith(`orgs/${orgId}/sources/`)) throw new Error("That file isn't yours.");
      const buf = await bytes(f.pathname);
      const ct = f.contentType;
      if (ct === "application/pdf") out.push({ kind: "pdf", name: f.name, data: buf.toString("base64") });
      else if (ct.includes("wordprocessingml")) out.push({ kind: "text", name: f.name, text: (await mammoth.extractRawText({ buffer: buf })).value });
      else if (ct.includes("presentationml")) out.push({ kind: "text", name: f.name, text: pptxText(buf) });
      else if (/^image\/(png|jpeg|webp|gif)$/.test(ct)) out.push({ kind: "image", name: f.name, mediaType: ct as "image/png", data: buf.toString("base64") });
    }
  } finally {
    await del(files.map((f) => f.pathname)).catch(() => undefined); // never keep the author's documents
  }
  return out;
}
