// Static guard (SECURITY-PRIVACY §4): outside targeting.ts, packages/dom must not read field values or page text.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BANNED = [/\.value\b/, /\binnerText\b/, /\btextContent\b(?!\s*=)/, /\bouterHTML\b/, /\binnerHTML\b(?!\s*=)/, /\bnodeValue\b/, /\bselectionStart\b/, /\bclipboard/i];
const ALLOWED = new Set(["targeting.ts"]);
const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/];

describe("privacy surface", () => {
  const dir = new URL(".", import.meta.url).pathname;
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  it("only targeting.ts reads names, labels, values or text", () => {
    const hits: string[] = [];
    for (const f of files.filter((f) => !ALLOWED.has(f))) {
      readFileSync(join(dir, f), "utf8").split("\n").forEach((line, i) => {
        if (line.trim().startsWith("//")) return;
        for (const re of BANNED) if (re.test(line)) hits.push(`${f}:${i + 1} ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
  it("has no network code at all", () => {
    const hits = files.filter((f) => NETWORK.some((re) => re.test(readFileSync(join(dir, f), "utf8"))));
    expect(hits).toEqual([]);
  });
});
