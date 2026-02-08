import { NextRequest, NextResponse } from "next/server";

/**
 * Dynamic PWA manifest endpoint.
 * 
 * Returns a manifest.json with a dynamic `start_url` that matches the page
 * where the user is adding the PWA to their home screen. This allows users
 * to bookmark specific regions or AOs with filter parameters.
 */
export async function GET(request: NextRequest) {
  // Get the referer to determine what page the user is on
  const referer = request.headers.get("referer");
  
  // Parse the URL to extract the path and query params
  let startUrl = "/";
  if (referer) {
    try {
      const url = new URL(referer);
      // Use the full path including query parameters
      startUrl = url.pathname + url.search;
    } catch (error) {
      // If parsing fails, default to root
      console.error("Failed to parse referer URL:", error);
    }
  }

  const manifest = {
    name: "F3 PAX Vault",
    short_name: "PAX Vault",
    description: "PAX Vault is a web application that provides real-time statistics and information about the F3 PAX (Fitness, Fellowship, Faith) community.",
    start_url: startUrl,
    display: "standalone",
    background_color: "#2E2E2E",
    display_override: ["window-controls-overlay", "standalone"],
    theme_color: "#FFFFFF",
    orientation: "portrait",
    lang: "en-US",
    icons: [
      {
        src: "/icons/icon-144x144.png",
        type: "image/png",
        sizes: "144x144",
      },
      {
        src: "/icons/icon-192x192.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        src: "/icons/icon-512x512.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/screenshot-600x1200.png",
        type: "image/png",
        sizes: "600x1200",
        form_factor: "narrow",
        label: "Mobile view",
      },
      {
        src: "/screenshots/screenshot-1200x600.png",
        type: "image/png",
        sizes: "1200x600",
        form_factor: "wide",
        label: "Desktop view",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Cache for a short time (60s) since the manifest is dynamic and changes
      // based on the page the user is on when installing the PWA. This ensures
      // that if users navigate to different pages before installing, they get
      // the correct start_url.
      "Cache-Control": "public, max-age=60",
    },
  });
}
