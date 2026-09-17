/**
 * 8 Box export — browser only.
 *
 * Shared by the version page's export buttons and the editor's Preview
 * modal so every surface produces identical files from the same export
 * node. html-to-image is imported lazily so it never lands in the server
 * bundle.
 *
 * Three outputs, one rasterization:
 *   - Download PNG  → the raster as-is.
 *   - Download PDF  → the raster embedded in a one-page landscape PDF
 *                     (see `lib/pdfImage.ts`).
 *   - Print         → the raster shown in a hidden iframe whose print dialog
 *                     is opened.
 */

import { buildImagePdf } from "@/lib/pdfImage";

/** Safari (desktop and iOS) — every non-Chromium WebKit. */
function isWebKit(): boolean {
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|CriOS|Edg/i.test(ua);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pax"
  );
}

/** `8box-double-dare-2026-q3-v2.png` (or `.pdf`). */
export function eightBoxExportFilename(
  f3Name: string,
  period: string,
  version: number | null | undefined,
  ext: "png" | "pdf",
): string {
  return `8box-${slug(f3Name)}-${slug(period)}${
    version != null ? `-v${version}` : ""
  }.${ext}`;
}

/** Rasterize an export board node to a PNG blob at 2× pixel ratio. */
export async function renderEightBoxPng(node: HTMLElement): Promise<Blob> {
  const { toPng } = await import("html-to-image");
  const options = {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    // No web fonts are loaded, so skip the stylesheet walk (which can throw
    // on cross-origin sheets) and render with the system font.
    skipFonts: true,
    cacheBust: true,
  };
  let dataUrl = await toPng(node, options);
  // WebKit's first render of a foreignObject is often incomplete; the second
  // call reliably includes all content.
  if (isWebKit()) dataUrl = await toPng(node, options);
  return (await fetch(dataUrl)).blob();
}

/**
 * Hand a file to the user: the share sheet on phones (Slack, Messages) when
 * available, otherwise a plain download. Resolves once the hand-off has been
 * initiated; a dismissed share sheet is not an error.
 */
export async function deliverFile(
  blob: Blob,
  filename: string,
  title: string,
): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });

  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (shareErr) {
      if ((shareErr as { name?: string })?.name === "AbortError") return;
      // Anything else: fall through to a plain download.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render + deliver the PNG. */
export async function downloadEightBoxPng(
  node: HTMLElement,
  filename: string,
  title: string,
): Promise<void> {
  const blob = await renderEightBoxPng(node);
  await deliverFile(blob, filename, title);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

/** Draw a PNG blob onto an opaque white canvas and return it + its pixels. */
async function rasterToCanvas(
  png: Blob,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const bitmap = await createImageBitmap(png);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, ctx };
}

/** zlib-deflate raw RGB pixels (lossless) via the browser's CompressionStream. */
async function deflateRgb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const { data } = ctx.getImageData(0, 0, width, height);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  const stream = new Blob([rgb]).stream().pipeThrough(
    // "deflate" is the zlib-wrapped format PDF's FlateDecode expects.
    new CompressionStream("deflate"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** JPEG fallback for browsers without CompressionStream. */
async function encodeJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("JPEG encoding failed");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Wrap a rendered board PNG in a one-page landscape PDF. */
export async function pngToEightBoxPdf(
  png: Blob,
  title: string,
): Promise<Blob> {
  const { canvas, ctx } = await rasterToCanvas(png);
  const { width, height } = canvas;

  const canDeflate = typeof CompressionStream === "function";
  const image = canDeflate
    ? {
        width,
        height,
        data: await deflateRgb(ctx, width, height),
        filter: "FlateDecode" as const,
      }
    : {
        width,
        height,
        data: await encodeJpeg(canvas),
        filter: "DCTDecode" as const,
      };

  const bytes = buildImagePdf(image, { title });
  return new Blob([bytes], { type: "application/pdf" });
}

/** Render + deliver the PDF. */
export async function downloadEightBoxPdf(
  node: HTMLElement,
  filename: string,
  title: string,
): Promise<void> {
  const png = await renderEightBoxPng(node);
  const pdf = await pngToEightBoxPdf(png, title);
  await deliverFile(pdf, filename, title);
}

// ── Print ───────────────────────────────────────────────────────────────────

/**
 * Print a rendered board PNG via a hidden same-origin iframe.
 *
 * Printing the live DOM node proved fragile: it lives inside cards with
 * `overflow: hidden` / `position: relative`, and print-media CSS that tries
 * to lift it out clips it to a blank page in Chrome. Rasterizing first and
 * printing the image makes the printout identical to the download and
 * independent of page layout, theme, or browser print quirks.
 *
 * Resolves once the print dialog has been requested. The iframe is removed
 * after printing (or after a generous timeout — Safari does not reliably fire
 * `afterprint`).
 */
export async function printEightBoxPng(
  blob: Blob,
  title: string,
): Promise<void> {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, "")}</title><style>
    @page { size: landscape; margin: 10mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { display: block; width: 100%; height: auto; }
  </style></head><body><img alt="8 Box"></body></html>`;

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => {
      const win = iframe.contentWindow;
      const img = win?.document.querySelector("img");
      if (!win || !img) {
        reject(new Error("Print frame did not initialize"));
        return;
      }
      img.onload = () => {
        // Let layout settle before printing, then print.
        win.requestAnimationFrame(() => {
          try {
            win.focus();
            win.print();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      };
      img.onerror = () => reject(new Error("Print image failed to load"));
      img.src = url;
    };
    document.body.appendChild(iframe);
  });

  const cleanup = () => {
    URL.revokeObjectURL(url);
    iframe.remove();
  };
  iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 60_000);
}

/** Render + print in one step. */
export async function printEightBoxNode(
  node: HTMLElement,
  title: string,
): Promise<void> {
  const blob = await renderEightBoxPng(node);
  await printEightBoxPng(blob, title);
}
