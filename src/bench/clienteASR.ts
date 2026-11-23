// Envoltorio con promesas sobre el worker de transcripción.
import type { ConfigMotor, MensajeAlWorker, MensajeDelWorker, ResultadoTranscripcion } from '../types';

export class ClienteASR {
  private worker: Worker;
  private pendientes = new Map<string, { ok: (r: ResultadoTranscripcion) => void; error: (e: Error) => void }>();
  private carga?: { ok: (r: { ms: number; backend: string }) => void; error: (e: Error) => void };
  onProgreso?: (archivo: string, cargado: number, total: number) => void;
  onAvance?: (segmento: number, total: number) => void;

  constructor() {
    this.worker = new Worker(new URL('../workers/asr.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => this.recibir(e.data);
    this.worker.onerror = (e) => this.fallarTodo(new Error(e.message || 'Error en el worker'));
  }

  private enviar(m: MensajeAlWorker, transferir: Transferable[] = []) {
    this.worker.postMessage(m, transferir);
  }

  private recibir(m: MensajeDelWorker) {
    if (m.tipo === 'progreso') this.onProgreso?.(m.archivo, m.cargado, m.total);
    else if (m.tipo === 'avance') this.onAvance?.(m.segmento, m.total);
    else if (m.tipo === 'listo') { this.carga?.ok({ ms: m.ms, backend: m.backend }); this.carga = undefined; }
    else if (m.tipo === 'resultado') { this.pendientes.get(m.id)?.ok(m.resultado); this.pendientes.delete(m.id); }
    else if (m.tipo === 'error') {
      const err = new Error(m.mensaje);
      if (m.id && this.pendientes.has(m.id)) { this.pendientes.get(m.id)!.error(err); this.pendientes.delete(m.id); }
      else if (this.carga) { this.carga.error(err); this.carga = undefined; }
    }
  }

  private fallarTodo(err: Error) {
    this.carga?.error(err);
    this.carga = undefined;
    for (const p of this.pendientes.values()) p.error(err);
    this.pendientes.clear();
  }

  cargar(config: ConfigMotor, base: string, hilos: number): Promise<{ ms: number; backend: string }> {
    return new Promise((ok, error) => {
      this.carga = { ok, error };
      this.enviar({ tipo: 'cargar', config, base, hilos });
    });
  }

  /** El audio se transfiere (no se copia): pasar una copia si se va a reutilizar. */
  transcribir(id: string, audio: Float32Array, terminosSesgo: string[]): Promise<ResultadoTranscripcion> {
    return new Promise((ok, error) => {
      this.pendientes.set(id, { ok, error });
      this.enviar({ tipo: 'transcribir', id, audio, terminosSesgo }, [audio.buffer]);
    });
  }

  terminar() {
    this.fallarTodo(new Error('Cancelado'));
    this.worker.terminate();
  }
}
