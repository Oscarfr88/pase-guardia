// ============================================================
// Worker de transcripción. El audio llega transferido (sin copia) desde la
// página y nunca sale del dispositivo. Un worker por configuración: al
// terminarlo se libera toda la memoria del modelo.
// ============================================================

import type { MensajeAlWorker, MensajeDelWorker } from '../types';
import * as transformers from './motores/transformers';

const ctx = self as unknown as {
  postMessage(m: MensajeDelWorker): void;
  onmessage: ((e: MessageEvent<MensajeAlWorker>) => void) | null;
};
const enviar = (m: MensajeDelWorker) => ctx.postMessage(m);

// Errores que escapan a los try/catch (por ejemplo, dentro del runtime de ONNX):
// se informan con su mensaje en lugar de un "Error en el worker" sin detalle.
self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const r = e.reason as Error | undefined;
  enviar({ tipo: 'error', mensaje: `Error no controlado: ${r?.message ?? String(r)}` });
});

ctx.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.tipo === 'cargar') {
      if (msg.config.motor !== 'transformers') throw new Error(`Motor no disponible todavía: ${msg.config.motor}`);
      const t0 = performance.now();
      const backend = await transformers.cargar(msg.config, msg.base, msg.hilos, (archivo, cargado, total) =>
        enviar({ tipo: 'progreso', archivo, cargado, total }),
      );
      enviar({ tipo: 'listo', ms: performance.now() - t0, backend });
    } else if (msg.tipo === 'transcribir') {
      const resultado = await transformers.transcribir(msg.audio, msg.terminosSesgo, (segmento, total) =>
        enviar({ tipo: 'avance', id: msg.id, segmento, total }),
      );
      enviar({ tipo: 'resultado', id: msg.id, resultado });
    } else if (msg.tipo === 'liberar') {
      await transformers.liberar();
    }
  } catch (err) {
    enviar({ tipo: 'error', id: msg.tipo === 'transcribir' ? msg.id : undefined, mensaje: err instanceof Error ? err.message : String(err) });
  }
};
