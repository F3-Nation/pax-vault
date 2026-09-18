import withPWA from "next-pwa";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https" as const,
        hostname: "a.slack-edge.com",
        pathname: "**",
      },
      {
        protocol: "https" as const,
        hostname: "avatars.slack-edge.com",
        pathname: "**",
      },
      {
        protocol: "https" as const,
        hostname: "secure.gravatar.com",
        pathname: "**",
      },
      {
        protocol: "https" as const,
        hostname: "storage.googleapis.com",
        pathname: "**",
      },
      {
        protocol: "https" as const,
        hostname: "placehold.in",
        pathname: "**",
      },
    ],
  },
};

const isDev = process.env.NODE_ENV === "development";

const withPWACustom = withPWA({
  dest: "public",
  disable: isDev,
  register: true,
  skipWaiting: true,
  // Keep the landing promo video out of the precache — otherwise every PWA
  // install downloads it up front. It's still runtime-cached once played.
  // (`!noprecache/**/*` is next-pwa's default, restated because this replaces it.)
  publicExcludes: ["!noprecache/**/*", "!promo/**/*"],
});

export default withPWACustom(nextConfig);
