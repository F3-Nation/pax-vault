"use client";

/**
 * ServiceWorkerRegister
 *
 * Client-side helper that registers the application service worker
 * to enable offline support and PWA capabilities.
 *
 * This component intentionally renders nothing and is meant to be
 * mounted once at the application root.
 */

// React hook used to register the service worker once on mount.
import { useEffect } from "react";

// Registers the service worker when running in a browser environment.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Ensure service workers are supported by the current browser.
    if ("serviceWorker" in navigator) {
      // Register the service worker at the root to control the entire app scope.
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("Service worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // This component renders nothing because it only manages service worker registration.
  return null; // This component doesn’t render anything visible
}
