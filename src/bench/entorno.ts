// Datos del dispositivo y del navegador que condicionan el rendimiento.

export interface Entorno {
  agente: string;
  aisladoOrigen: boolean;
  nucleos: number;
  memoriaGB?: number;
  webgpu: { disponible: boolean; adaptador?: string; f16?: boolean; maxBufferMB?: number; error?: string };
  almacenamiento?: { usoMB: number; cuotaMB: number; persistente?: boolean };
}

export async function detectarEntorno(): Promise<Entorno> {
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: { requestAdapter(): Promise<unknown> } };
  const e: Entorno = {
    agente: navigator.userAgent,
    aisladoOrigen: window.crossOriginIsolated,
    nucleos: navigator.hardwareConcurrency ?? 1,
    memoriaGB: nav.deviceMemory,
    webgpu: { disponible: false },
  };
  if (nav.gpu) {
    try {
      const a = (await nav.gpu.requestAdapter()) as
        | { features: Set<string>; limits: { maxBufferSize: number }; info?: Record<string, string> }
        | null;
      if (a) {
        const info = a.info ?? {};
        e.webgpu = {
          disponible: true,
          adaptador: [info.vendor, info.architecture, info.description].filter(Boolean).join(' · ') || 'sin datos',
          f16: a.features.has('shader-f16'),
          maxBufferMB: Math.round(a.limits.maxBufferSize / 1e6),
        };
      } else e.webgpu = { disponible: false, error: 'requestAdapter() devolvió null' };
    } catch (err) {
      e.webgpu = { disponible: false, error: String(err) };
    }
  }
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) {
      e.almacenamiento = {
        usoMB: Math.round((est.usage ?? 0) / 1e6),
        cuotaMB: Math.round((est.quota ?? 0) / 1e6),
        persistente: await navigator.storage.persisted?.(),
      };
    }
  } catch {
    /* sin datos de almacenamiento */
  }
  return e;
}

export function hilosRecomendados(): number {
  return window.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1)) : 1;
}
