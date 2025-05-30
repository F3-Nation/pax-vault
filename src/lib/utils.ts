export function getBaseUrl() {
  const isServer = typeof window === 'undefined';

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (isServer && process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  throw new Error('NEXT_PUBLIC_SITE_URL must be defined in production');
}