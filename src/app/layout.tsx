/**
 * Root application layout.
 *
 * Notes:
 * - Global CSS is imported once here.
 * - `<head>` contains PWA + theme metadata.
 * - Providers are composed at the app root to ensure consistent context.
 */
import "@/styles/globals.css";
import { Providers } from "./providers";
import NavbarComponent from "@/components/navbar";
import ServiceWorkerRegister from "@/lib/service-worker";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme colors (used by some browsers for the address bar / UI chrome). */}
        <meta
          name="theme-color"
          content="#fff"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#18181b"
          media="(prefers-color-scheme: dark)"
        />

        {/* Prevent indexing by search engines (app is not public). */}
        <meta name="robots" content="noindex"></meta>

        {/* PWA / iOS web app settings. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />

        {/* App icons. */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icons/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/icons/favicon-16x16.png"
        />
      </head>

      <body>
        {/* Registers the service worker client-side for offline/PWA behavior. */}
        <ServiceWorkerRegister />

        {/* ThemeProvider must wrap components that rely on theme classes. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NavbarComponent />

          {/* App-wide UI providers (toasts, modals, HeroUI, etc.). */}
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
