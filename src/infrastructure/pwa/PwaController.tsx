'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';

export function PwaController() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(worker);
          }
        });
      });
    }).catch(() => undefined);
  }, []);

  if (!waitingWorker) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-xl">
      <p className="text-sm font-semibold text-slate-800">Nueva versión disponible</p>
      <Button className="min-h-12" onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}>
        <RefreshCw /> Actualizar aplicación
      </Button>
    </div>
  );
}
