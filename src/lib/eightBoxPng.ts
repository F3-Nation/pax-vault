/**
 * 8 Box PNG capture — browser only.
 *
 * Shared by the version page's "Download PNG" and the editor's Preview modal
 * so both produce byte-identical files from the same export node. Uses
 * html-to-image, imported lazily so it never lands in the server bundle.
 */

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

/** `8box-double-dare-2026-q3-v2.png` */
export function eightBoxPngFilename(
  f3Name: string,
  period: string,
  version?: number | null,
): string {
  return `8box-${slug(f3Name)}-${slug(period)}${
    version != null ? `-v${version}` : ""
  }.png`;
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
 * Hand a PNG to the user: the share sheet on phones (Slack, Messages) when
 * available, otherwise a plain download. Resolves once the hand-off has been
 * initiated; a dismissed share sheet is not an error.
 */
export async function deliverEightBoxPng(
  blob: Blob,
  filename: string,
  title: string,
): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });

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

/** Render + deliver in one step. */
export async function downloadEightBoxPng(
  node: HTMLElement,
  filename: string,
  title: string,
): Promise<void> {
  const blob = await renderEightBoxPng(node);
  await deliverEightBoxPng(blob, filename, title);
}
