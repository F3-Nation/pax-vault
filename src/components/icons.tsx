import * as React from 'react';

export function MapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" {...props}>
      <path d="M408 120c0 54.6-73.1 151.9-105.2 192c-7.7 9.6-22 9.6-29.6 0C241.1 271.9 168 174.6 168 120C168 53.7 221.7 0 288 0s120 53.7 120 120zm8 80.4c3.5-6.9 6.7-13.8 9.6-20.6c.5-1.2 1-2.5 1.5-3.7l116-46.4C558.9 123.4 576 135 576 152l0 270.8c0 9.8-6 18.6-15.1 22.3L416 503l0-302.6zM137.6 138.3c2.4 14.1 7.2 28.3 12.8 41.5c2.9 6.8 6.1 13.7 9.6 20.6l0 251.4L32.9 502.7C17.1 509 0 497.4 0 480.4L0 209.6c0-9.8 6-18.6 15.1-22.3l122.6-49zM327.8 332c13.9-17.4 35.7-45.7 56.2-77l0 249.3L192 449.4 192 255c20.5 31.3 42.3 59.6 56.2 77c20.5 25.6 59.1 25.6 79.6 0zM288 152a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"/>
    </svg>
  );
}

export function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" {...props}>
      <path d="M168 0h48v48h-48zM192 512C106 407.6 0 327.2 0 224 0 100.3 86 0 192 0s192 100.3 192 224c0 103.2-106 183.6-192 288zM192 272a64 64 0 1 0 0-128 64 64 0 1 0 0 128z" />
    </svg>
  );
}

export function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" {...props}>
      <path d="M224 256a128 128 0 1 0 0-256 128 128 0 1 0 0 256zm89.6 32h-11.8c-22.2 10.3-46.9 16-73.8 16s-51.6-5.7-73.8-16h-11.8C60.3 288 0 348.3 0 422.4V464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48v-41.6c0-74.1-60.3-134.4-134.4-134.4z" />
    </svg>
  );
}