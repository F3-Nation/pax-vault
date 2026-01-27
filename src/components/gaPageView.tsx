"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!window.gtag) return;

    const qs = searchParams.toString();
    const page = qs ? `${pathname}?${qs}` : pathname;

    window.gtag("event", "page_view", {
      page_path: page,
    });
  }, [pathname, searchParams]);

  return null;
}
