'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('U& Service Worker registered successfully scope:', reg.scope);
          })
          .catch((err) => {
            console.log('U& Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
