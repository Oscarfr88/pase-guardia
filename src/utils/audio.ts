// ============================================================
// Audio: decodificación a PCM mono 16 kHz y segmentación por pausas.
// Whisper procesa ventanas de 30 s: se corta en los silencios más
// profundos para no partir palabras y se saltean los tramos sin voz
// (sobre el silencio el modelo tiende a inventar texto).
// ============================================================

export const FRECUENCIA = 16000;

/** Decodifica un archivo de audio (wav, m4a, mp3…) a Float32 mono 16 kHz. Solo en la página. */
export async function decodificarAudio(datos: ArrayBuffer): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, FRECUENCIA);
  const buf = await ctx.decodeAudioData(datos);
  if (buf.sampleRate === FRECUENCIA && buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  // Mezcla a mono y re-muestrea con un render offline.
  const frames = Math.ceil(buf.duration * FRECUENCIA);
  const off = new OfflineAudioContext(1, frames, FRECUENCIA);
  const fuente = off.createBufferSource();
  fuente.buffer = buf;
  fuente.connect(off.destination);
  fuente.start();
  const render = await off.startRendering();
  return render.getChannelData(0).slice();
}

export interface Tramo {
  inicio: number; // muestra
  fin: number; // muestra (exclusiva)
  silencio: boolean;
}

export interface OpcionesSegmentacion {
  maxSegundos: number;
  minSegundos: number;
  /** Por debajo de este nivel (dBFS) un tramo se considera silencio. */
  umbralSilencioDb: number;
}

const POR_DEFECTO: OpcionesSegmentacion = { maxSegundos: 28, minSegundos: 12, umbralSilencioDb: -45 };

function db(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-9));
}

export function segmentarPorPausas(
  audio: Float32Array,
  sr = FRECUENCIA,
  opciones: Partial<OpcionesSegmentacion> = {},
): Tramo[] {
  const o = { ...POR_DEFECTO, ...opciones };
  const marco = Math.round(sr * 0.03);
  const nMarcos = Math.ceil(audio.length / marco);
  const energia = new Float32Array(nMarcos);
  for (let f = 0; f < nMarcos; f++) {
    let s = 0;
    const ini = f * marco, fin = Math.min(audio.length, ini + marco);
    for (let i = ini; i < fin; i++) s += audio[i] * audio[i];
    energia[f] = db(Math.sqrt(s / Math.max(1, fin - ini)));
  }
  // Suavizado de 5 marcos (150 ms) para elegir pausas reales y no un valle aislado.
  const suave = energia.map((_, f) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, f - 2); k <= Math.min(nMarcos - 1, f + 2); k++) { s += energia[k]; n++; }
    return s / n;
  });

  const tramos: Tramo[] = [];
  const maxM = Math.floor((o.maxSegundos * sr) / marco);
  const minM = Math.floor((o.minSegundos * sr) / marco);
  let ini = 0;
  while (ini < nMarcos) {
    let fin: number;
    if (nMarcos - ini <= maxM) {
      fin = nMarcos;
    } else {
      let mejor = ini + maxM, valor = Infinity;
      for (let f = ini + minM; f < ini + maxM; f++) if (suave[f] < valor) { valor = suave[f]; mejor = f; }
      fin = mejor;
    }
    let pico = -Infinity;
    for (let f = ini; f < fin; f++) pico = Math.max(pico, energia[f]);
    tramos.push({ inicio: ini * marco, fin: Math.min(audio.length, fin * marco), silencio: pico < o.umbralSilencioDb });
    ini = fin;
  }
  return tramos;
}
