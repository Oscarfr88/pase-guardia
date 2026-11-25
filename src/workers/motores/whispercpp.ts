// ============================================================
// Motor Whisper con whisper.cpp compilado a WebAssembly (SIMD + hilos).
// El runtime (public/motores/whispercpp) y el modelo ggml (/modelos/whispercpp)
// se sirven desde el mismo origen. Este archivo no hace ninguna otra petición.
//
// Memoria: el modelo se descarga bloque a bloque directo a la memoria de
// WebAssembly (sin copia intermedia en JavaScript) y se libera apenas
// whisper.cpp terminó de leerlo, antes de reservar la memoria de cálculo.
// Con Transformers.js, `small` pedía ~6 veces su tamaño al cargar y el
// iPhone 13 cerraba la página.
// ============================================================

import type { ConfigMotor, ResultadoTranscripcion, Segmento } from '../../types';
import { FRECUENCIA, segmentarPorPausas } from '../../utils/audio';
import { ENCABEZADO_PROMPT } from '../../utils/diccionario';
import { descargaResistente } from '../../utils/descargaResistente';
import type { Progreso } from './transformers';

/** Mismo presupuesto que el otro motor (whisper.cpp admite hasta 224 tokens). */
const MAX_TOKENS_PROMPT = 150;
/** Tamaño del grupo de hilos con que se compiló (PTHREAD_POOL_SIZE). */
const HILOS_COMPILADOS = 4;

interface ModuloWhisper {
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  _malloc(n: number): number;
  _free(p: number): void;
  _pg_iniciar(datos: number, n: number): number;
  _pg_crear_estado(): number;
  _pg_tokens(texto: number): number;
  _pg_transcribir(audio: number, n: number, prompt: number, hilos: number): number;
  _pg_liberar(): void;
  _pg_sistema(): number;
  UTF8ToString(p: number): string;
  stringToNewUTF8(s: string): number;
}

let mod: ModuloWhisper | null = null;
let hilosUsados = 1;

export async function cargar(config: ConfigMotor, base: string, hilos: number, progreso: Progreso): Promise<string> {
  if (!config.archivo) throw new Error(`Falta el archivo del modelo en ${config.id}.`);
  if (!self.crossOriginIsolated) throw new Error('whisper.cpp necesita aislamiento de origen para usar hilos.');

  const url = `${base}motores/whispercpp/whisper.mjs`;
  const crear = (await import(/* @vite-ignore */ url)).default as () => Promise<ModuloWhisper>;
  mod = await crear();
  hilosUsados = Math.max(1, Math.min(hilos, HILOS_COMPILADOS));

  const ruta = `${config.carpeta}/${config.archivo}`;
  const r = await descargaResistente(`${base}modelos/${ruta}`);
  if (!r.ok || !r.body) throw new Error(`No se pudo descargar ${config.archivo} (HTTP ${r.status}).`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!total) throw new Error(`El servidor no informó el tamaño de ${config.archivo}.`);

  const ptr = mod._malloc(total);
  if (!ptr) throw new Error(`No hay memoria para el modelo (${(total / 1e6).toFixed(0)} MB).`);
  try {
    const lector = r.body.getReader();
    let pos = 0;
    let ultimoPct = -1;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (pos + value.byteLength > total) throw new Error(`${config.archivo} es más grande de lo esperado.`);
      mod.HEAPU8.set(value, ptr + pos); // HEAPU8 se relee: la memoria pudo crecer
      pos += value.byteLength;
      const pct = Math.floor((100 * pos) / total);
      if (pct !== ultimoPct) {
        ultimoPct = pct;
        progreso(ruta, pos, total);
      }
    }
    if (pos !== total) throw new Error(`Descarga incompleta de ${config.archivo} (${pos} de ${total} bytes).`);
    if (mod._pg_iniciar(ptr, total) !== 0) throw new Error(`whisper.cpp no pudo leer ${config.archivo}.`);
  } finally {
    mod._free(ptr); // whisper.cpp ya copió los pesos a sus propios búferes
  }
  // Recién ahora la memoria de cálculo: reutiliza el espacio que ocupaba el archivo.
  if (mod._pg_crear_estado() !== 0) throw new Error('No hay memoria para los búferes de cálculo de whisper.cpp.');

  // Calentamiento, igual que en el otro motor: no contamina la medición de tiempos.
  transcribirTramo(new Float32Array(FRECUENCIA), '');
  return `whisper.cpp wasm (${hilosUsados} hilo${hilosUsados > 1 ? 's' : ''})`;
}

function contarTokens(texto: string): number {
  const m = mod!;
  const p = m.stringToNewUTF8(texto);
  try {
    return m._pg_tokens(p);
  } finally {
    m._free(p);
  }
}

/** Prompt de sesgo: encabezado y términos del diccionario hasta llenar el presupuesto. */
function armarPrompt(terminos: string[]): { texto: string; tokens: number } {
  if (!terminos.length) return { texto: '', tokens: 0 };
  let elegido = { texto: '', tokens: 0 };
  const elegidos: string[] = [];
  for (const t of terminos) {
    const texto = ` ${ENCABEZADO_PROMPT} ${[...elegidos, t].join(', ')}.`;
    const tokens = contarTokens(texto);
    if (tokens > MAX_TOKENS_PROMPT) break;
    elegidos.push(t);
    elegido = { texto, tokens };
  }
  return elegido;
}

function transcribirTramo(audio: Float32Array, prompt: string): string {
  const m = mod;
  if (!m) throw new Error('El modelo no está cargado.');
  const pa = m._malloc(audio.length * 4);
  if (!pa) throw new Error('No hay memoria para el audio.');
  const pp = prompt ? m.stringToNewUTF8(prompt) : 0;
  try {
    m.HEAPF32.set(audio, pa / 4);
    const r = m._pg_transcribir(pa, audio.length, pp, hilosUsados);
    if (!r) throw new Error('whisper.cpp no pudo transcribir el tramo.');
    return m.UTF8ToString(r).trim();
  } finally {
    m._free(pa);
    if (pp) m._free(pp);
  }
}

export async function transcribir(
  audio: Float32Array,
  terminosSesgo: string[],
  avance: (segmento: number, total: number) => void,
): Promise<ResultadoTranscripcion> {
  const t0 = performance.now();
  const prompt = armarPrompt(terminosSesgo);
  const tramos = segmentarPorPausas(audio);
  const segmentos: Segmento[] = [];
  for (let i = 0; i < tramos.length; i++) {
    avance(i + 1, tramos.length);
    // Cede el turno para que el aviso de avance salga antes del cálculo (que bloquea el worker).
    await new Promise((r) => setTimeout(r, 0));
    const tr = tramos[i];
    if (tr.silencio) continue;
    const texto = transcribirTramo(audio.subarray(tr.inicio, tr.fin), prompt.texto);
    if (texto) segmentos.push({ inicio: tr.inicio / FRECUENCIA, fin: tr.fin / FRECUENCIA, texto });
  }
  return {
    texto: segmentos.map((s) => s.texto).join(' ').replace(/\s+/g, ' ').trim(),
    segmentos,
    ms: performance.now() - t0,
    tokensPrompt: prompt.tokens,
    // whisper.cpp reintenta por su cuenta (subiendo la temperatura) y no informa cuántas veces.
    reintentos: 0,
  };
}

export async function liberar(): Promise<void> {
  mod?._pg_liberar();
  mod = null;
}
