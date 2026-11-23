// Registro del service worker. La primera vez que toma el control, la página se
// recarga una sola vez para quedar "aislada" (crossOriginIsolated) y poder usar
// hilos de WebAssembly. Si el navegador no lo permite, la app funciona igual con un hilo.

const CLAVE_RECARGA = 'pase-guardia:recarga-aislamiento';

export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base })
    .then(() => {
      if (window.crossOriginIsolated) {
        sessionStorage.removeItem(CLAVE_RECARGA);
        return;
      }
      const recargar = () => {
        if (sessionStorage.getItem(CLAVE_RECARGA)) return; // evita bucles
        sessionStorage.setItem(CLAVE_RECARGA, '1');
        window.location.reload();
      };
      if (navigator.serviceWorker.controller) recargar();
      else navigator.serviceWorker.addEventListener('controllerchange', recargar, { once: true });
    })
    .catch(() => {
      /* sin service worker: la app sigue funcionando, sin modo offline */
    });
}

/** Rechaza correr dentro de un iframe de otro sitio (la CSP por <meta> no admite frame-ancestors). */
export function impedirIframe(): boolean {
  try {
    if (window.top !== window.self) {
      document.body.textContent = 'Esta aplicación no puede abrirse dentro de otro sitio.';
      return true;
    }
  } catch {
    document.body.textContent = 'Esta aplicación no puede abrirse dentro de otro sitio.';
    return true;
  }
  return false;
}
