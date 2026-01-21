/**
 * Application-wide providers.
 *
 * This file centralizes all context providers that must wrap the app
 * (UI systems, toasts, modals, etc.).
 *
 * Keeping this separate from `layout.tsx` avoids provider sprawl
 * and makes future additions predictable.
 */

import { HeroUIProvider } from "@heroui/system";
import type { ReactNode } from "react";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  // HeroUIProvider supplies design-system context (themes, tokens, overlays).
  return <HeroUIProvider>{children}</HeroUIProvider>;
}
