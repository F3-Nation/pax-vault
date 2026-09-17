/**
 * Minimal single-image PDF writer.
 *
 * Builds a one-page PDF that places one raster image, scaled to fit inside
 * the page margins while keeping its aspect ratio. No dependency: the PDF
 * object graph is tiny (catalog, pages, page, image XObject, content stream)
 * and the byte offsets for the xref table are computed as the file is
 * assembled.
 *
 * Pure and environment-agnostic (Uint8Array in, Uint8Array out) so it can be
 * unit tested in Node; the browser-side rasterization lives in
 * `lib/eightBoxPdf.ts`.
 */

export interface PdfImageSource {
  /** Pixel dimensions of the image. */
  width: number;
  height: number;
  /** Encoded image bytes: a JPEG file for DCTDecode, zlib-deflated RGB for FlateDecode. */
  data: Uint8Array;
  filter: "DCTDecode" | "FlateDecode";
}

export interface PdfPageOptions {
  /** Page size in PDF points (1/72 in). Defaults to US Letter landscape. */
  pageWidth?: number;
  pageHeight?: number;
  /** Uniform margin in points. */
  margin?: number;
  /** Document title metadata. */
  title?: string;
}

/** US Letter, landscape, in points. */
export const LETTER_LANDSCAPE = { width: 792, height: 612 } as const;

const encoder = new TextEncoder();

function bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Escape a string for a PDF literal string `( … )`. */
function pdfString(value: string): string {
  // Keep it ASCII-safe: PDF literal strings are byte strings and this writer
  // does not emit a Unicode BOM, so non-ASCII characters are dropped.
  const ascii = value.replace(/[^\x20-\x7e]/g, "");
  return `(${ascii.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3);
}

/**
 * Where the image lands on the page: centered, scaled to fit the margins.
 * Exported for tests.
 */
export function fitImageOnPage(
  imageWidth: number,
  imageHeight: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): { x: number; y: number; width: number; height: number } {
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const scale = Math.min(maxW / imageWidth, maxH / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

/** Assemble the PDF bytes. */
export function buildImagePdf(
  image: PdfImageSource,
  options: PdfPageOptions = {},
): Uint8Array {
  const pageWidth = options.pageWidth ?? LETTER_LANDSCAPE.width;
  const pageHeight = options.pageHeight ?? LETTER_LANDSCAPE.height;
  const margin = options.margin ?? 28; // ~10 mm
  const placed = fitImageOnPage(
    image.width,
    image.height,
    pageWidth,
    pageHeight,
    margin,
  );

  // Content stream: draw /Im0 with a transform of [w 0 0 h x y].
  const content = bytes(
    `q ${formatNumber(placed.width)} 0 0 ${formatNumber(placed.height)} ${formatNumber(placed.x)} ${formatNumber(placed.y)} cm /Im0 Do Q\n`,
  );

  const imageDict =
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter} /Length ${image.data.length} >>`;

  const infoDict = options.title
    ? `<< /Title ${pdfString(options.title)} /Producer (PAX Vault) >>`
    : `<< /Producer (PAX Vault) >>`;

  // Objects in order 1..6. Each entry is the full "N 0 obj … endobj\n" body.
  const objects: Uint8Array[][] = [
    [bytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")],
    [bytes("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")],
    [
      bytes(
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
          `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
      ),
    ],
    [
      bytes(`4 0 obj\n${imageDict}\nstream\n`),
      image.data,
      bytes("\nendstream\nendobj\n"),
    ],
    [
      bytes(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`),
      content,
      bytes("endstream\nendobj\n"),
    ],
    [bytes(`6 0 obj\n${infoDict}\nendobj\n`)],
  ];

  const parts: Uint8Array[] = [bytes("%PDF-1.4\n%âãÏÓ\n")];
  let offset = parts[0].length;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(offset);
    for (const chunk of obj) {
      parts.push(chunk);
      offset += chunk.length;
    }
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) {
    xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(bytes(xref));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
