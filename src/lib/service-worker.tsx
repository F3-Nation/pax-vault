"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          logger.info(`Service Worker registered with scope: ${registration.scope}`);
        })
        .catch((error) => {
          logger.error("Service Worker registration failed.", error);
        });
    }
  }, []);

  return null; // This component doesn't render anything visible
}
