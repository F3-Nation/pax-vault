// app/layout.tsx
import "@/styles/globals.css";
import { Providers } from "./providers";
import NavbarComponent from "@/components/navbar-server";
import ServiceWorkerRegister from "@/lib/service-worker";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="manifest" href="/manifest.json" />
      <body>
        <ServiceWorkerRegister />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NavbarComponent />
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
