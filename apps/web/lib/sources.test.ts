import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

describe("pptxText", async () => {
  // lib/sources.ts imports "server-only"; test the parser through a tiny re-export-free copy of the input.
  const { pptxText } = await import("./sources.ts");
  it("reads slide text and speaker notes in slide order", () => {
    const slide = (t: string[]) => `<p:sld><a:p><a:r><a:t>${t[0]}</a:t></a:r><a:r><a:t>${t[1] ?? ""}</a:t></a:r></a:p></p:sld>`;
    const zip = zipSync({
      "ppt/slides/slide10.xml": strToU8(slide(["Ten"])),
      "ppt/slides/slide2.xml": strToU8(slide(["Click ", "Save &amp; Close"])),
      "ppt/notesSlides/notesSlide2.xml": strToU8(slide(["Say why it matters"])),
      "ppt/media/image1.png": new Uint8Array([1, 2, 3]),
    });
    expect(pptxText(zip)).toBe("Slide 2:\nClick Save & Close\nSpeaker notes: Say why it matters\n\nSlide 10:\nTen");
  });
});
