// ============================================================
// Motor Whisper con Transformers.js (ONNX Runtime Web), en WebGPU o WASM.
// Todo se carga desde el mismo origen: modelos en /modelos/ y el runtime de ONNX
// como un archivo más del build.
// ============================================================

import {
  AutoProcessor,
  AutoTokenizer,
  env,
  WhisperForConditionalGeneration,
  type PreTrainedTokenizer,
  type Processor,
} from '@huggingface/transformers';
// Runtime de ONNX empaquetado por Vite junto con la app (nunca desde un CDN).
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import type { ConfigMotor, ResultadoTranscripcion, Segmento } from '../../types';
import { ENCABEZADO_PROMPT } from '../../utils/diccionario';
import { FRECUENCIA, segmentarPorPausas } from '../../utils/audio';
import { hayBucle } from '../../utils/bucles';

/** Presupuesto de tokens para el prompt de sesgo (Whisper admite hasta 224). */
const MAX_TOKENS_PROMPT = 150;
const MAX_POSICIONES = 448;

interface IdsEspeciales {
  inicio: number; // <|startoftranscript|>
  espanol: number; // <|es|>
  transcribir: number; // <|transcribe|>
  sinTiempos: number; // <|notimestamps|>
  previo: number; // <|startofprev|>
}

let modelo: WhisperForConditionalGeneration | null = null;
let procesador: Processor | null = null;
let tokenizador: PreTrainedTokenizer | null = null;
let ids: IdsEspeciales | null = null;

export type Progreso = (archivo: string, cargado: number, total: number) => void;

export async function cargar(config: ConfigMotor, base: string, hilos: number, progreso: Progreso): Promise<string> {
  if (config.dispositivo === 'webgpu' && !('gpu' in navigator)) {
    throw new Error('Este navegador no tiene WebGPU.');
  }
  // Sin descargas de terceros: ni modelos de Hugging Face ni el runtime desde un CDN.
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  // Ruta sin dominio: Transformers.js trata las URL absolutas (http…) como remotas
  // y, con las descargas remotas desactivadas, no las busca.
  env.localModelPath = new URL(`${base}modelos/`).pathname;
  env.useBrowserCache = false;
  (env as unknown as { useWasmCache: boolean }).useWasmCache = false;
  const onnx = env.backends.onnx as unknown as {
    wasm: { wasmPaths: unknown; numThreads: number; proxy: boolean };
  };
  onnx.wasm.wasmPaths = {
    mjs: new URL(ortMjs, self.location.href).href,
    wasm: new URL(ortWasm, self.location.href).href,
  };
  onnx.wasm.numThreads = hilos;
  onnx.wasm.proxy = false;

  const gen = await (await fetch(`${base}modelos/${config.carpeta}/generation_config.json`)).json();
  ids = {
    inicio: gen.decoder_start_token_id,
    espanol: gen.lang_to_id['<|es|>'],
    transcribir: gen.task_to_id.transcribe,
    sinTiempos: gen.no_timestamps_token_id,
    previo: gen.prev_sot_token_id,
  };

  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.file) progreso(p.file, p.loaded ?? 0, p.total ?? 0);
  };
  tokenizador = await AutoTokenizer.from_pretrained(config.carpeta);
  procesador = await AutoProcessor.from_pretrained(config.carpeta);
  modelo = (await WhisperForConditionalGeneration.from_pretrained(config.carpeta, {
    device: config.dispositivo,
    dtype: config.dtype as never,
    progress_callback,
  })) as WhisperForConditionalGeneration;

  // Calentamiento: la primera inferencia compila shaders (WebGPU) o inicializa
  // memoria (WASM). Se hace acá para no contaminar la medición de tiempos.
  await generarTokens(new Float32Array(FRECUENCIA), []);
  return config.dispositivo === 'webgpu' ? 'webgpu' : `wasm (${hilos} hilo${hilos > 1 ? 's' : ''})`;
}

function tokensDePrompt(terminos: string[]): number[] {
  if (!tokenizador || !terminos.length) return [];
  const codificar = (s: string) => tokenizador!.encode(` ${s}`, { add_special_tokens: false }) as number[];
  const elegidos: string[] = [];
  let tokens: number[] = [];
  for (const t of terminos) {
    const prueba = codificar(`${ENCABEZADO_PROMPT} ${[...elegidos, t].join(', ')}.`);
    if (prueba.length > MAX_TOKENS_PROMPT) break;
    elegidos.push(t);
    tokens = prueba;
  }
  return tokens;
}

async function generarTokens(audio: Float32Array, prompt: number[], extra: Record<string, number> = {}): Promise<{ tokens: number[]; tope: boolean }> {
  if (!modelo || !procesador || !ids) throw new Error('El modelo no está cargado.');
  const { input_features } = await procesador(audio);
  const inicio = [ids.inicio, ids.espanol, ids.transcribir, ids.sinTiempos];
  const entrada = prompt.length ? [ids.previo, ...prompt, ...inicio] : inicio;
  const maximo = Math.min(224, MAX_POSICIONES - entrada.length - 1);
  const salida = (await modelo.generate({
    inputs: input_features,
    decoder_input_ids: entrada,
    max_new_tokens: maximo,
    ...extra,
  } as never)) as unknown as { tolist(): (number | bigint)[][] };
  const secuencia = salida.tolist()[0].map(Number);
  // La salida incluye el prefijo (prompt + tokens de inicio): se descarta.
  const corte = secuencia.indexOf(ids.sinTiempos);
  const nuevos = corte >= 0 ? secuencia.slice(corte + 1) : secuencia.slice(entrada.length);
  return { tokens: nuevos, tope: nuevos.length >= maximo };
}

/**
 * Transcribe un tramo. Si el modelo cae en un bucle de repetición o agota el máximo
 * de tokens (señal típica de alucinación), reintenta una vez penalizando las
 * repeticiones, como hace Whisper con su "fallback". El texto no se edita: si el
 * reintento también falla, queda el resultado y el post-proceso lo marca.
 */
async function generar(audio: Float32Array, prompt: number[]): Promise<{ texto: string; reintento: boolean }> {
  if (!tokenizador) throw new Error('El modelo no está cargado.');
  let r = await generarTokens(audio, prompt);
  let reintento = false;
  if (hayBucle(r.tokens) || r.tope) {
    const r2 = await generarTokens(audio, prompt, { repetition_penalty: 1.2, no_repeat_ngram_size: 4 });
    reintento = true;
    if (!hayBucle(r2.tokens)) r = r2;
  }
  return { texto: tokenizador.decode(r.tokens, { skip_special_tokens: true }).trim(), reintento };
}

export async function transcribir(
  audio: Float32Array,
  terminosSesgo: string[],
  avance: (segmento: number, total: number) => void,
): Promise<ResultadoTranscripcion> {
  const t0 = performance.now();
  const prompt = tokensDePrompt(terminosSesgo);
  const tramos = segmentarPorPausas(audio);
  const segmentos: Segmento[] = [];
  let reintentos = 0;
  for (let i = 0; i < tramos.length; i++) {
    avance(i + 1, tramos.length);
    const tr = tramos[i];
    if (tr.silencio) continue;
    const { texto, reintento } = await generar(audio.subarray(tr.inicio, tr.fin), prompt);
    if (reintento) reintentos++;
    if (texto) segmentos.push({ inicio: tr.inicio / FRECUENCIA, fin: tr.fin / FRECUENCIA, texto });
  }
  return {
    texto: segmentos.map((s) => s.texto).join(' ').replace(/\s+/g, ' ').trim(),
    segmentos,
    ms: performance.now() - t0,
    tokensPrompt: prompt.length,
    reintentos,
  };
}

export async function liberar(): Promise<void> {
  await modelo?.dispose();
  modelo = null;
  procesador = null;
  tokenizador = null;
}
