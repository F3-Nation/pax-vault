import { describe, it, expect } from "vitest";
import { buildImagePdf, fitImageOnPage, LETTER_LANDSCAPE } from "./pdfImage";

const decoder = new TextDecoder("latin1");

describe("fitImageOnPage", () => {
  it("scales a wide image to the page width and centers it vertically", () => {
    const p = fitImageOnPage(2400, 1200, 792, 612, 28);
    expect(p.width).toBeCloseTo(736);
    expect(p.height).toBeCloseTo(368);
    expect(p.x).toBeCloseTo(28);
    expect(p.y).toBeCloseTo((612 - 368) / 2);
  });

  it("scales a tall image to the page height and centers it horizontally", () => {
    const p = fitImageOnPage(1000, 4000, 792, 612, 28);
    expect(p.height).toBeCloseTo(556);
    expect(p.width).toBeCloseTo(139);
    expect(p.y).toBeCloseTo(28);
    expect(p.x).toBeCloseTo((792 - 139) / 2);
  });
});

describe("buildImagePdf", () => {
  const data = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // a fake JPEG
  const pdf = buildImagePdf(
    { width: 200, height: 100, data, filter: "DCTDecode" },
    { title: "Double Dare — 8 Box (test)" },
  );
  const text = decoder.decode(pdf);

  it("has a header, one landscape Letter page, and an image XObject", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain(
      `/MediaBox [0 0 ${LETTER_LANDSCAPE.width} ${LETTER_LANDSCAPE.height}]`,
    );
    expect(text).toContain("/Subtype /Image /Width 200 /Height 100");
    expect(text).toContain("/Filter /DCTDecode /Length 4");
    expect(text).toContain("/Im0 Do");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("embeds the image bytes verbatim", () => {
    const idx = text.indexOf("stream\n", text.indexOf("4 0 obj")) + 7;
    expect(Array.from(pdf.slice(idx, idx + 4))).toEqual([
      0xff, 0xd8, 0xff, 0xd9,
    ]);
  });

  it("writes a correct xref table (every offset points at its object)", () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");

    const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    expect(entries).toHaveLength(6);
    entries.forEach((offset, i) => {
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(
        `${i + 1} 0 obj`,
      );
    });
  });

  it("escapes and ASCII-folds the title", () => {
    expect(text).toContain("/Title (Double Dare  8 Box \\(test\\))");
  });
});
