'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('U& Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.log('U& Service Worker registration failed:', err);
          });
      });
    } else {
      // In development, unregister any active service worker to prevent Turbopack chunk caching conflicts
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
          console.log('U& Service Worker unregistered for dev mode');
        }
      });
    }
  }, []);

  return null;
}
