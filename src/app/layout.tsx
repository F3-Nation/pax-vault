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
import Script from "next/script";
import { GaPageView } from "@/components/gaPageView";
import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth/AuthProvider";

type RootLayoutProps = {
  children: ReactNode;
};

const isLocalhost =
  typeof window !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1");

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

        {/* Google Analytics */}
        {!isLocalhost && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=G-T1VBJ3V20T`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-T1VBJ3V20T', {
              anonymize_ip: true,
            });
          `}
            </Script>
          </>
        )}

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
        {/* Google Analytics page view tracking. */}
        <Suspense fallback={null}>
          <GaPageView />
        </Suspense>
        {/* ThemeProvider must wrap components that rely on theme classes. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <NavbarComponent />

            {/* App-wide UI providers (toasts, modals, HeroUI, etc.). */}
            <Providers>{children}</Providers>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
