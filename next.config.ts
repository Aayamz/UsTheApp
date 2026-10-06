import type { NextConfig } from "next";

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      // HTML page loads must always hit the network -- this app is
      // auth-gated, so a cached page can show the wrong signed-in state.
      urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request }: { request: Request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'worker',
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-resources' },
    },
    {
      urlPattern: ({ request }: { request: Request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/:path((?:workbox|sw).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
