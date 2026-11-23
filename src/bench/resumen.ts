import type { CargaConfig, ItemResultado } from '../context/BenchContext';

export interface FilaResumen {
  configId: string;
  conPrompt: boolean;
  dictados: number;
  fallos: number;
  werCrudo: number;
  werPost: number;
  terminosCrudo: number;
  terminosPost: number;
  /** Tiempo de transcripción / duración del audio. */
  rtf: number;
  segundosPorMinuto: number;
  cargaS?: number;
  backend?: string;
}

/** Agrega por configuración y modo de prompt. WER ponderado por palabras de referencia. */
export function resumir(resultados: ItemResultado[], cargas: CargaConfig[]): FilaResumen[] {
  const grupos = new Map<string, ItemResultado[]>();
  for (const r of resultados) {
    const k = `${r.configId}|${r.conPrompt}`;
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
  const filas: FilaResumen[] = [];
  for (const [k, items] of grupos) {
    const [configId, p] = k.split('|');
    const ok = items.filter((i) => !i.error && i.werCrudo);
    const suma = (f: (i: ItemResultado) => number) => ok.reduce((s, i) => s + f(i), 0);
    const err = (w?: { sustituciones: number; borrados: number; inserciones: number }) => (w ? w.sustituciones + w.borrados + w.inserciones : 0);
    const palabrasC = suma((i) => i.werCrudo!.palabrasReferencia);
    const palabrasP = suma((i) => i.werPost!.palabrasReferencia);
    const audio = suma((i) => i.duracionAudio);
    const carga = cargas.find((c) => c.configId === configId);
    filas.push({
      configId,
      conPrompt: p === 'true',
      dictados: ok.length,
      fallos: items.length - ok.length,
      werCrudo: palabrasC ? suma((i) => err(i.werCrudo)) / palabrasC : NaN,
      werPost: palabrasP ? suma((i) => err(i.werPost)) / palabrasP : NaN,
      terminosCrudo: suma((i) => i.terminosCrudo!.aciertos) / Math.max(1, suma((i) => i.terminosCrudo!.total)),
      terminosPost: suma((i) => i.terminosPost!.aciertos) / Math.max(1, suma((i) => i.terminosPost!.total)),
      rtf: audio ? suma((i) => i.ms) / 1000 / audio : NaN,
      segundosPorMinuto: audio ? (suma((i) => i.ms) / 1000 / audio) * 60 : NaN,
      cargaS: carga?.ms !== undefined ? carga.ms / 1000 : undefined,
      backend: carga?.backend,
    });
  }
  return filas.sort((a, b) => a.configId.localeCompare(b.configId) || Number(b.conPrompt) - Number(a.conPrompt));
}

export const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1).replace('.', ',')} %` : '—');
export const num = (n: number | undefined, d = 1) => (n !== undefined && Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '—');
