/// <reference lib="webworker" />
// ============================================================
// Service worker propio.
//  - Precachea SOLO la interfaz y el runtime (nunca datos clínicos: la app no
//    hace peticiones con datos, todo vive cifrado en IndexedDB).
//  - Agrega los encabezados COOP/COEP a sus respuestas: GitHub Pages no permite
//    configurarlos y son necesarios para los hilos de WebAssembly
//    (SharedArrayBuffer). Misma técnica que coi-serviceworker.
//  - Los modelos (/modelos/) NO pasan por el service worker: en Safari (iOS)
//    re-empaquetar una descarga de decenas o cientos de MB la corta ("Load failed").
//    No necesitan los encabezados: son del mismo origen. Su caché llega en la etapa 4.
// ============================================================

import { matchPrecache, precache, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

precache(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

function conAislamiento(r: Response): Response {
  if (r.status === 0 || r.type === 'opaque' || r.type === 'opaqueredirect') return r;
  const h = new Headers(r.headers);
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

const BASE = new URL(self.registration.scope).pathname; // "/pase-guardia/"

async function responder(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    const pagina = url.pathname.startsWith(`${BASE}bench`) ? `${BASE}bench/index.html` : `${BASE}index.html`;
    const precacheada = (await matchPrecache(url.pathname)) ?? (await matchPrecache(pagina));
    if (precacheada) return conAislamiento(precacheada);
    return conAislamiento(await fetch(req));
  }
  const precacheada = await matchPrecache(req.url);
  return conAislamiento(precacheada ?? (await fetch(req)));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Solo el propio origen; cualquier otra cosa la bloquea igual la CSP.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${BASE}modelos/`)) return; // directo a la red (ver arriba)
  e.respondWith(responder(e.request));
});
