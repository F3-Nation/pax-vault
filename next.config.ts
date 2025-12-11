
import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https' as const,
        hostname: 'a.slack-edge.com',
        pathname: '**',
      },
      {
        protocol: 'https' as const,
        hostname: 'avatars.slack-edge.com',
        pathname: '**',
      },
      {
        protocol: 'https' as const,
        hostname: 'secure.gravatar.com',
        pathname: '**',
      },
      {
        protocol: 'https' as const,
        hostname: 'storage.googleapis.com',
        pathname: '**',
      },
      {
        protocol: 'https' as const,
        hostname: 'placehold.in',
        pathname: '**',
      },
    ]
  }
};

const isDev = process.env.NODE_ENV === 'development';

const withPWACustom = withPWA({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
});

export default withPWACustom(nextConfig);