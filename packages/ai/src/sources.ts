// Source material for AI drafting: what the author uploads (notes, job aids, decks, PDFs, screenshots, frames
// from a screen recording). Turned into Claude content blocks; limits keep one request well within the API's.
import type Anthropic from "@anthropic-ai/sdk";

export type Source =
  | { kind: "text"; name: string; text: string }
  | { kind: "pdf"; name: string; data: string } // base64
  | { kind: "image"; name: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string }; // base64

export const LIMITS = { images: 60, pdfBytes: 30 * 1024 * 1024, totalBytes: 28 * 1024 * 1024, textChars: 400_000 };

const b64bytes = (s: string) => Math.floor((s.length * 3) / 4);

/** Check sources fit one request. Returns a plain-words problem, or null. */
export function checkSources(sources: Source[]): string | null {
  const images = sources.filter((s) => s.kind === "image").length;
  if (images > LIMITS.images) return `That's ${images} images and frames. Use ${LIMITS.images} or fewer (a shorter video, or fewer screenshots).`;
  const text = sources.reduce((n, s) => n + (s.kind === "text" ? s.text.length : 0), 0);
  if (text > LIMITS.textChars) return "That's too much text for one coach. Split the process, or upload fewer documents.";
  for (const s of sources) if (s.kind === "pdf" && b64bytes(s.data) > LIMITS.pdfBytes) return `${s.name} is too large (PDFs up to 30 MB).`;
  const total = sources.reduce((n, s) => n + (s.kind === "text" ? s.text.length : b64bytes(s.data)), 0);
  if (total > LIMITS.totalBytes) return "Those files are too large together. Upload fewer, or smaller, files.";
  return null;
}

const clean = (s: string) => s.replace(/<\/?source[^>]*>/gi, "");

/** Content blocks for the user turn: each source labelled, documents first, then images in order. */
export function sourceBlocks(sources: Source[]): Anthropic.Beta.BetaContentBlockParam[] {
  const out: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const s of sources) {
    const label = clean(s.name).slice(0, 120);
    if (s.kind === "text") out.push({ type: "text", text: `<source name="${label}">\n${clean(s.text)}\n</source>` });
    else if (s.kind === "pdf") out.push({ type: "text", text: `<source name="${label}" type="pdf">` }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: s.data }, title: label });
    else out.push({ type: "text", text: `<source name="${label}" type="image">` }, { type: "image", source: { type: "base64", media_type: s.mediaType, data: s.data } });
  }
  return out;
}
