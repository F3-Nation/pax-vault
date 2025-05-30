
import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'a.slack-edge.com',
      'avatars.slack-edge.com',
      'secure.gravatar.com',
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