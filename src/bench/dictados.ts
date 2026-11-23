// Textos de referencia de los 20 dictados sintéticos (incluidos en el build: son ficticios).
// Los audios NO se incluyen: se eligen desde el dispositivo.

export interface DictadoReferencia {
  id: string; // "01"…"20"
  literal: string;
  esperado?: string;
  terminos: string[];
}

const archivos = import.meta.glob('../../tests/fixtures/dictados/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const REFERENCIAS: Record<string, DictadoReferencia> = {};
for (const [ruta, contenido] of Object.entries(archivos)) {
  const m = ruta.match(/dictado-(\d{2})\.(?:(terminos|esperado)\.)?txt$/);
  if (!m) continue;
  const [, id, tipo] = m;
  const d = (REFERENCIAS[id] ??= { id, literal: '', terminos: [] });
  if (tipo === 'terminos') d.terminos = contenido.split('\n').map((s) => s.trim()).filter(Boolean);
  else if (tipo === 'esperado') d.esperado = contenido.trim();
  else d.literal = contenido.replace(/\s*\n\s*/g, ' ').trim();
}

/** Cribado de la ronda 1: marcadores, puntuación hablada, ruido y sin marcadores. */
export const CRIBADO = ['01', '03', '07', '12', '16'];
export const TODOS = Object.keys(REFERENCIAS).sort();

/** "dictado-07.m4a", "Dictado 7.wav", "07.wav" → "07" */
export function idDeArchivo(nombre: string): string | null {
  const m = nombre.match(/(?:dictado[-_ ]?)?(\d{1,2})(?=\D*\.[a-z0-9]+$)/i);
  if (!m) return null;
  const id = m[1].padStart(2, '0');
  return REFERENCIAS[id] ? id : null;
}
